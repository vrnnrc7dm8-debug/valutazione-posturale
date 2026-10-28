"""Explicit local lifecycle operations. No migrations, automatic merges or implicit cascades."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import re
import time
from uuid import uuid4


def archived_codes(archive):
    folder = archive.safe_path('.patient-status')
    result = set()
    if folder.exists():
        for directory in folder.iterdir():
            if directory.is_symlink() or not directory.is_dir():
                continue
            events = [(json.loads(p.read_text()), p.stat().st_mtime_ns) for p in directory.glob('*.json') if re.fullmatch(r'[a-f0-9]{32}\.json', p.name)]
            latest = max(events, key=lambda item: item[0].get('sequence', item[1]))[0] if events else None
            if latest and latest.get('archived'):
                result.add(directory.name)
    return result


def fingerprint(archive, c, code):
    ArchiveError, MARKER = archive.error, archive.marker
    patient = c.execute('SELECT * FROM Pazienti WHERE Codice_Clinico=?', (code,)).fetchone()
    if not patient:
        raise ArchiveError('Paziente non trovato.', 404)
    rows = c.execute('SELECT * FROM Valutazioni_Posturali WHERE ID_Paziente=?', (patient['ID_Paziente'],)).fetchall()
    keys = set()
    for row in rows:
        if not (row['Note'] or '').startswith(MARKER):
            raise ArchiveError('Valutazione in formato diverso: eliminazione bloccata; puoi archiviare il paziente.', 409)
        meta = json.loads(row['Note'][len(MARKER):])
        archive.load(code, row['ID_Valutazione'])  # Verifies associations and every current referenced file.
        keys.add(meta['key'])
    # Unknown clinical dependants are never cascaded implicitly.
    allowed = {'Valutazioni_Posturali', 'Profilo_Antropometrico', 'Antropometria_Valutazioni'}
    for table_row in c.execute("SELECT name FROM sqlite_master WHERE type='table'"):
        table = table_row[0]
        if table.startswith('sqlite_') or table in allowed:
            continue
        for fk in c.execute('PRAGMA foreign_key_list("'+table.replace('"', '""')+'")'):
            if fk['table'] == 'Pazienti':
                count = c.execute('SELECT count(*) FROM "'+table.replace('"', '""')+'" WHERE "'+fk['from'].replace('"', '""')+'"=?', (patient[fk['to'] or 'ID_Paziente'],)).fetchone()[0]
                if count:
                    raise ArchiveError('Dipendenze cliniche aggiuntive presenti: eliminazione bloccata. Usa Archivia.', 409)
            elif fk['table'] == 'Valutazioni_Posturali' and rows:
                ids = [row['ID_Valutazione'] for row in rows]
                count = c.execute('SELECT count(*) FROM "'+table.replace('"', '""')+'" WHERE "'+fk['from'].replace('"', '""')+'" IN ('+','.join('?' for _ in ids)+')', ids).fetchone()[0]
                if count:
                    raise ArchiveError('Dipendenze della valutazione non gestibili senza cascata: eliminazione bloccata. Usa Archivia.', 409)
    files = {}
    folder = archive.safe_path(code)
    if folder.exists():
        for path in folder.rglob('*'):
            if any(part.startswith('._') or part == '.DS_Store' for part in path.relative_to(folder).parts):
                continue
            if path.is_symlink():
                raise ArchiveError('Associazione file non verificabile: link simbolico.', 409)
            if path.is_file():
                relative = str(path.relative_to(folder))
                if relative.startswith(('valutazioni/', 'report/')):
                    key = path.stem.split('-')[0]
                    if key not in keys:
                        raise ArchiveError('File non associato alle valutazioni indicizzate: eliminazione bloccata.', 409)
                files[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    tables = {row[0] for row in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    measurements = {}
    if 'Profilo_Antropometrico' in tables:
        measurements['profile'] = [dict(row) for row in c.execute('SELECT * FROM Profilo_Antropometrico WHERE ID_Paziente=?', (patient['ID_Paziente'],))]
    if 'Antropometria_Valutazioni' in tables:
        measurements['snapshots'] = [dict(row) for row in c.execute('SELECT * FROM Antropometria_Valutazioni WHERE ID_Valutazione IN (SELECT ID_Valutazione FROM Valutazioni_Posturali WHERE ID_Paziente=?) ORDER BY ID_Valutazione', (patient['ID_Paziente'],))]
    value = {'measurements': measurements, 'patient': dict(patient), 'evaluations': [dict(row) for row in rows], 'files': files}
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest(), value


def manage(archive, request):
    ArchiveError = archive.error
    code = archive.code(request['code'])
    action = request['action']
    with archive.connect() as c:
        if not c.execute('SELECT 1 FROM Pazienti WHERE Codice_Clinico=?', (code,)).fetchone():
            raise ArchiveError('Paziente non trovato.', 404)
        if action in ('archive', 'restore'):
            folder = archive.safe_path('.patient-status/'+code)
            folder.mkdir(parents=True, exist_ok=True, mode=0o700)
            path = folder/(uuid4().hex+'.json')
            with path.open('x') as f:
                os.chmod(path, 0o600)
                json.dump({'archived': action == 'archive', 'sequence': time.time_ns()}, f)
                f.flush(); os.fsync(f.fileno())
            return {'archived': action == 'archive'}
        if action == 'prepare-delete':
            # Hold writer lock while backing up database and files into a consistent receipt.
            c.execute('BEGIN IMMEDIATE')
            token, value = fingerprint(archive, c, code)
            backup_id = uuid4().hex
            folder = archive.safe_path('.verified-backups/'+backup_id)
            folder.mkdir(parents=True, mode=0o700)
            with sqlite3.connect(archive.database.as_uri()+'?mode=ro', uri=True) as source, sqlite3.connect(folder/'database.db') as destination:
                source.backup(destination)
                def logical_hash(database):
                    value = hashlib.sha256()
                    for statement in database.iterdump(): value.update(statement.encode())
                    return value.hexdigest()
                if logical_hash(source) != logical_hash(destination) or destination.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                    raise ArchiveError('Backup SQLite non verificato.', 503)
            os.chmod(folder/'database.db', 0o600)
            if archive.safe_path(code).exists():
                shutil.copytree(archive.safe_path(code), folder/'patient', ignore=shutil.ignore_patterns('._*', '.DS_Store'))
            for relative, digest in value['files'].items():
                if hashlib.sha256((folder/'patient'/relative).read_bytes()).hexdigest() != digest:
                    raise ArchiveError('Backup dei file non verificato.', 503)
            receipt = {'code': code, 'fingerprint': token, 'files': value['files'], 'databaseHash': hashlib.sha256((folder/'database.db').read_bytes()).hexdigest()}
            (folder/'receipt.json').write_text(json.dumps(receipt))
            os.chmod(folder/'receipt.json', 0o600)
            return {'backupId': backup_id, 'verified': True, 'evaluations': len(value['evaluations']), 'files': len(value['files'])}
        if action == 'delete':
            if request.get('confirmation') != 'ELIMINA '+code:
                raise ArchiveError('Conferma esplicita mancante.', 409)
            backup_id = request.get('backupId', '')
            if len(backup_id) != 32 or any(ch not in '0123456789abcdef' for ch in backup_id):
                raise ArchiveError('Backup verificato richiesto.', 409)
            folder = archive.safe_path('.verified-backups/'+backup_id)
            receipt = json.loads((folder/'receipt.json').read_text())
            c.execute('BEGIN IMMEDIATE')
            token, value = fingerprint(archive, c, code)
            if receipt['code'] != code or receipt['fingerprint'] != token or hashlib.sha256((folder/'database.db').read_bytes()).hexdigest() != receipt['databaseHash']:
                raise ArchiveError('Archivio cambiato o backup non valido: ripetere la preparazione.', 409)
            for relative, digest in receipt['files'].items():
                if hashlib.sha256((folder/'patient'/relative).read_bytes()).hexdigest() != digest:
                    raise ArchiveError('Backup file alterato: eliminazione bloccata.', 409)
            pid = value['patient']['ID_Paziente']
            tables = {row[0] for row in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if 'Profilo_Antropometrico' in tables:
                c.execute('DELETE FROM Profilo_Antropometrico WHERE ID_Paziente=?', (pid,))
            if 'Antropometria_Valutazioni' in tables:
                c.execute('DELETE FROM Antropometria_Valutazioni WHERE ID_Valutazione IN (SELECT ID_Valutazione FROM Valutazioni_Posturali WHERE ID_Paziente=?)', (pid,))
            c.execute('DELETE FROM Valutazioni_Posturali WHERE ID_Paziente=?', (pid,))
            c.execute('DELETE FROM Pazienti WHERE ID_Paziente=?', (pid,))
            archive.check()
            # Original files remain intact as an additional safety copy; never unlink clinical files.
            return {'deleted': True, 'filesRetained': True, 'backupId': backup_id}
        raise ArchiveError('Operazione non disponibile.')
