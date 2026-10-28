"""Local clinical archive. Never creates or migrates the configured SQLite database."""
import base64
import anthropometry
from contextlib import contextmanager
import copy
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from synthpose_service import SERVICE as SYNTHPOSE_SERVICE, SynthPoseError
from urllib.parse import parse_qs, urlsplit, unquote
from uuid import uuid4

CODE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$')
MARKER = 'POSTURAL_APP_V1:'
PLANES = {'frontale_anteriore': 'Foto_Frontale_Anteriore', 'frontale_posteriore': 'Foto_Frontale_Posteriore', 'sagittale_destro': 'Foto_Sagittale_Dx', 'sagittale_sinistro': 'Foto_Sagittale_Sx'}

class ArchiveError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

class Archive:
    error = ArchiveError
    marker = MARKER
    def __init__(self, database, root, volume, require_mount=True):
        self.database = Path(database).absolute()
        self.root = Path(root).absolute()
        self.volume = Path(volume).absolute()
        self.require_mount = require_mount

    def check(self):
        if not self.volume.is_dir() or (self.require_mount and not os.path.ismount(self.volume)):
            raise ArchiveError('Lexar non collegato: accesso e scritture bloccati.', 503)
        if not self.database.is_file():
            raise ArchiveError('Database configurato non disponibile. Nessun database alternativo creato.', 503)
        for path in (self.database.resolve(), self.root.resolve()):
            if not path.is_relative_to(self.volume.resolve()):
                raise ArchiveError('Archivio esterno al volume configurato.', 503)

    @contextmanager
    def connect(self):
        self.check()
        c = sqlite3.connect(self.database.as_uri() + '?mode=rw', uri=True)
        c.row_factory = sqlite3.Row
        c.execute('PRAGMA foreign_keys=ON')
        c.execute('PRAGMA busy_timeout=5000')
        required = {'Pazienti': {'ID_Paziente', 'Codice_Clinico', 'Nome', 'Cognome', 'Sesso', 'Note', 'Data_Modifica'}, 'Valutazioni_Posturali': {'ID_Valutazione', 'ID_Paziente', 'Note', 'Dati_Landmark', 'Dati_Angolari', 'Referto', 'Data_Valutazione', 'Tipo_Valutazione', *PLANES.values()}}
        for table, columns in required.items():
            actual = {r['name'] for r in c.execute(f'PRAGMA table_info({table})')}
            if not columns <= actual:
                c.close()
                raise ArchiveError('Schema SQLite incompatibile: nessuna modifica eseguita.', 503)
        try:
            with c:
                yield c
        finally:
            c.close()

    def code(self, value):
        if not isinstance(value, str) or not CODE.fullmatch(value):
            raise ArchiveError('Codice clinico non valido: usare lettere, numeri, trattini o underscore (max 80).')
        return value

    def safe_path(self, relative):
        candidate = self.root / relative
        if any(part.is_symlink() for part in (candidate, *candidate.parents) if part != self.volume and part.is_relative_to(self.volume)):
            raise ArchiveError('Link simbolici non consentiti nell’archivio.')
        p = candidate.resolve()
        if not p.is_relative_to(self.root.resolve()):
            raise ArchiveError('Percorso archivio non valido.')
        self.check()
        return p

    def patient(self, row, c=None):
        result = {'id': row['Codice_Clinico'], 'codiceClinico': row['Codice_Clinico'], 'nome': row['Nome'] or '', 'cognome': row['Cognome'] or '', 'sesso': row['Sesso'] or '', 'noteCliniche': row['Note'] or '', 'eta': '', 'operatore': '', 'dataValutazione': ''}

        current = anthropometry.profile(c, row['ID_Paziente']) if c is not None else None
        if current is not None:
            result['antropometria'] = current
        return result

    def patients(self, query=''):
        with self.connect() as c:
            rows = c.execute('SELECT * FROM Pazienti WHERE instr(lower(Codice_Clinico || char(32) || coalesce(Nome,\'\') || char(32) || coalesce(Cognome,\'\')), lower(?)) > 0 ORDER BY Cognome, Nome, Codice_Clinico LIMIT 200', (query,)).fetchall()
            return [self.patient(r, c) for r in rows]

    def patient_directory(self, query='', offset=0, limit=25, archived=False):
        offset, limit = max(0, int(offset)), min(100, max(1, int(limit)))
        where = "instr(lower(Codice_Clinico || char(32) || coalesce(Nome,'') || char(32) || coalesce(Cognome,'')), lower(?)) > 0"
        with self.connect() as c:
            from patient_management import archived_codes
            hidden = archived_codes(self)
            all_rows = c.execute('SELECT * FROM Pazienti WHERE '+where+' ORDER BY Cognome,Nome,Codice_Clinico', (query,)).fetchall()
            visible = [r for r in all_rows if (r['Codice_Clinico'] in hidden) == archived]
            patients = []
            for row in visible[offset:offset+limit]:
                patient = self.patient(row, c)
                history = self.evaluations(patient['id'])
                patient.update({'evaluationCount': len(history), 'lastEvaluationDate': max((v['date'] or '' for v in history), default=''), 'archived': archived})
                patient.update({'photoCount': sum(v.get('photoCount') or 0 for v in history), 'landmarkCount': sum(v.get('landmarkCount') or 0 for v in history), 'alterationCount': sum(v.get('alterationCount') or 0 for v in history), 'hasReport': any(v.get('hasReport') for v in history)})
                patient['homonymCount'] = c.execute("SELECT count(*) FROM Pazienti WHERE lower(trim(coalesce(Nome,'')))=lower(trim(?)) AND lower(trim(coalesce(Cognome,'')))=lower(trim(?)) AND Codice_Clinico<>?", (patient['nome'], patient['cognome'], patient['id'])).fetchone()[0]
                patients.append(patient)
            return {'patients': patients, 'total': len(visible), 'offset': offset, 'limit': limit}

    def get_patient(self, code):
        with self.connect() as c:
            row = c.execute('SELECT * FROM Pazienti WHERE Codice_Clinico=?', (self.code(code),)).fetchone()
            if row is None:
                raise ArchiveError('Paziente non trovato.', 404)
            return self.patient(row, c)

    def homonyms(self, patient, c):
        rows = c.execute("SELECT * FROM Pazienti WHERE lower(trim(coalesce(Nome,'')))=lower(trim(?)) AND lower(trim(coalesce(Cognome,'')))=lower(trim(?)) AND Codice_Clinico<>?", (patient.get('nome', ''), patient.get('cognome', ''), patient['id'])).fetchall()
        if not str(patient.get('nome', '')).strip() or not str(patient.get('cognome', '')).strip():
            return []
        result = []
        for row in rows:
            history = self.evaluations(row['Codice_Clinico'])
            result.append({**self.patient(row, c), 'evaluationCount': len(history), 'photoCount': sum(v.get('photoCount') or 0 for v in history), 'landmarkCount': sum(v.get('landmarkCount') or 0 for v in history), 'hasReport': any(v.get('hasReport') for v in history)})
        return result

    def preview_import(self, patient, c=None):
        if c is None:
            with self.connect() as connection:
                return self.preview_import(patient, connection)
        code = self.code(patient['id'])
        row = c.execute('SELECT * FROM Pazienti WHERE Codice_Clinico=?', (code,)).fetchone()
        history = c.execute('SELECT ID_Valutazione,Data_Valutazione,Note FROM Valutazioni_Posturali WHERE ID_Paziente=? ORDER BY ID_Valutazione', (row['ID_Paziente'],)).fetchall() if row else []
        fingerprint = json.dumps({'incoming': patient, 'existing': dict(row) if row else None, 'profile': self.patient(row, c) if row else None, 'history': [dict(r) for r in history]}, sort_keys=True, ensure_ascii=False)
        return {'candidates': self.homonyms(patient, c), 'exists': row is not None, 'patient': self.patient(row, c) if row else None, 'evaluations': [{'id': r[0], 'date': r[1]} for r in history], 'token': hashlib.sha256(fingerprint.encode()).hexdigest()}

    def write_patient(self, c, p, create=False):
        code = self.code(p['id'])
        values = (str(p.get('nome', '')), str(p.get('cognome', '')), str(p.get('sesso', '')), str(p.get('noteCliniche', '')))
        row = c.execute('SELECT ID_Paziente FROM Pazienti WHERE Codice_Clinico=?', (code,)).fetchone()
        if create and row:
            raise ArchiveError('Codice clinico già presente.', 409)
        if row:
            c.execute('UPDATE Pazienti SET Nome=?, Cognome=?, Sesso=?, Note=?, Data_Modifica=CURRENT_TIMESTAMP WHERE ID_Paziente=?', (*values, row[0]))
            return row[0]
        c.execute('INSERT INTO Pazienti (Codice_Clinico, Nome, Cognome, Sesso, Note) VALUES (?,?,?,?,?)', (code, *values))
        return c.execute('SELECT last_insert_rowid()').fetchone()[0]

    def save_patient(self, p, create=False):
        with self.connect() as c:
            c.execute('BEGIN IMMEDIATE')
            if create and self.homonyms(p, c) and not p.get('allowHomonym'):
                raise ArchiveError('Omonimo già presente: conferma esplicita richiesta.', 409)
            data = self.anthropometry_for_save(c, p)
            pid = self.write_patient(c, p, create)
            if data is not None and 'antropometria' in p:
                anthropometry.write_profile(c, pid, data)
        return p

    def anthropometry_for_save(self, c, patient, requested=False):
        if not anthropometry.ready(c):
            if requested or 'antropometria' in patient:
                raise ArchiveError('Antropometria non attivata: predisporre il backup verificato ed eseguire la migrazione dedicata. Nessun dato antropometrico salvato.', 503)
            return None
        try:
            return anthropometry.snapshot(patient)
        except (ValueError, TypeError):
            raise ArchiveError('Peso, altezza, età o data non validi. Peso 0,3–500 kg; altezza 20–260 cm; età 0–120 anni.')

    def evaluations(self, code):
        self.code(code)
        with self.connect() as c:
            results = [dict(r) for r in c.execute('SELECT v.ID_Valutazione AS id, v.Data_Valutazione AS date FROM Valutazioni_Posturali v JOIN Pazienti p ON p.ID_Paziente=v.ID_Paziente WHERE p.Codice_Clinico=? ORDER BY v.ID_Valutazione DESC', (code,))]
            for result in results:
                result['antropometriaSnapshot'] = anthropometry.load_snapshot(c, result['id'])
                note = c.execute('SELECT Note FROM Valutazioni_Posturali WHERE ID_Valutazione=?', (result['id'],)).fetchone()[0]
                if (note or '').startswith(MARKER):
                    meta = json.loads(note[len(MARKER):])
                    try:
                        result.update(self.snapshot_summary(code, meta['snapshot'], meta['key']))
                    except ArchiveError:
                        result.update({'unavailable': True, 'photoCount': None, 'landmarkCount': None, 'alterationCount': None, 'hasReport': None})
            return results

    def snapshot_summary(self, code, path, key):
        if not path.startswith(code + '/valutazioni/'):
            raise ArchiveError('Associazione documento/paziente non valida.', 409)
        try:
            a = json.loads(self.safe_path(path).read_text())
            if a['patient']['id'] != code or a.get('archiveKey') != key:
                raise ArchiveError('Identificativi del documento non coerenti con la valutazione.', 409)
            def landmarks(photo):
                value = photo.get('annotations', {}).get('landmarks', {})
                return len(value) if isinstance(value, list) else len(value.get('manual', [])) + len(value.get('semiAutomatic', []))
            return {'photoCount': sum(bool(p.get('archivePhoto') or p.get('dataUrl')) for p in a.get('photos', [])), 'landmarkCount': sum(landmarks(p) for p in a.get('photos', [])), 'alterationCount': sum(len(p.get('alterations', [])) for p in a.get('planeAssessments', [])), 'hasReport': bool(a.get('report')), 'revision': Path(path).stem.removeprefix(key+'-'), 'key': key}
        except FileNotFoundError:
            return {'unavailable': True, 'photoCount': None, 'landmarkCount': None, 'alterationCount': None, 'hasReport': None, 'key': key}

    def revisions(self, code, eid):
        self.code(code)
        with self.connect() as c:
            row = c.execute('SELECT v.Note FROM Valutazioni_Posturali v JOIN Pazienti p ON p.ID_Paziente=v.ID_Paziente WHERE p.Codice_Clinico=? AND v.ID_Valutazione=?', (code, eid)).fetchone()
            if not row or not (row[0] or '').startswith(MARKER):
                raise ArchiveError('Valutazione non disponibile.', 404)
            meta = json.loads(row[0][len(MARKER):])
            folder = self.safe_path(code+'/valutazioni')
            result = []
            for path in sorted(folder.glob(meta['key']+'-*.json'), key=lambda p: p.stat().st_mtime, reverse=True):
                summary = self.snapshot_summary(code, str(path.relative_to(self.root.resolve())), meta['key'])
                result.append({**summary, 'updatedAt': json.loads(path.read_text()).get('updatedAt'), 'current': str(path.relative_to(self.root.resolve())) == meta['snapshot']})
            return result

    def save(self, assessment, import_guard=None):
        a = copy.deepcopy(assessment)
        if a.get('recoveredRevision'):
            raise ArchiveError('Revisione storica in sola lettura: crea una copia esplicita per modificarla.', 409)
        p = a['patient']
        code = self.code(p['id'])
        key = uuid4().hex if import_guard is not None else str(a.get('archiveKey', ''))
        if not re.fullmatch(r'[a-f0-9]{32}', key):
            raise ArchiveError('Identificativo valutazione non valido.')
        revision = uuid4().hex
        base = f'{code}'
        files = []
        photo_refs = {}
        # Immutable revisions: a failed DB commit cannot corrupt the previous evaluation.
        def stage(relative, data):
            target = self.safe_path(relative)
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            self.check()
            with target.open('xb') as f:
                os.chmod(target, 0o600)
                f.write(data)
                f.flush()
                os.fsync(f.fileno())
            files.append(relative)
            return relative
        with self.connect() as c:
            c.execute('BEGIN IMMEDIATE')
            existing_pid = None
            if import_guard is not None:
                preview = self.preview_import(p, c)
                if not hmac.compare_digest(str(import_guard.get('token', '')), preview['token']):
                    raise ArchiveError('Archivio cambiato dopo l’anteprima. Ripetere anteprima e conferma.', 409)
                expected_mode = 'new-evaluation' if preview['exists'] else 'create-patient'
                if import_guard.get('mode') != expected_mode:
                    raise ArchiveError('Conflitto importazione: rivedere il paziente di destinazione.', 409)
                key = uuid4().hex
                a['archiveKey'] = key
                if preview['exists']:
                    existing_pid = c.execute('SELECT ID_Paziente FROM Pazienti WHERE Codice_Clinico=?', (code,)).fetchone()[0]
            from patient_management import archived_codes
            if code in archived_codes(self):
                raise ArchiveError('Paziente archiviato: ripristinarlo prima di salvare.', 409)
            if not c.execute('SELECT 1 FROM Pazienti WHERE Codice_Clinico=?', (code,)).fetchone() and self.homonyms(p, c) and not a.get('allowHomonym'):
                raise ArchiveError('Omonimo già presente. Confronta i codici e lo storico in Archivio prima di confermare un nuovo paziente.', 409)
            profile_requested = 'antropometria' in p
            anthro = self.anthropometry_for_save(c, p, a.get('antropometriaSnapshot') is not None)
            if anthro is not None:
                a['antropometriaSnapshot'] = anthro
                p['antropometria'] = {k: anthro[k] for k in ('pesoKg', 'altezzaCm')}
                if a.get('report') is not None:
                    a['report'].setdefault('antropometria', {**anthro, 'bmi': anthropometry.bmi(anthro)})
            pid = existing_pid if existing_pid is not None else self.write_patient(c, p)
            for folder in ('foto', 'valutazioni', 'report', 'allegati'):
                self.safe_path(f'{base}/{folder}').mkdir(parents=True, exist_ok=True, mode=0o700)
            report_photos = (a.get('report') or {}).get('photographs', [])
            for photo in report_photos:
                source_plane = photo.pop('reportSourcePlane', None)
                if source_plane is not None:
                    source = next((current for current in a.get('photos', []) if current.get('plane') == source_plane and source_plane == photo.get('plane')), None)
                    if not source or not source.get('dataUrl'):
                        raise ArchiveError('Fotografia sorgente del report non disponibile. Rigenerare il report.')
                    photo['dataUrl'] = source['dataUrl']
            for photo in [*a.get('photos', []), *report_photos]:
                for kind, obj in [('main', photo), ('baseline', photo.get('baseline'))]:
                    if not obj:
                        continue
                    data = obj.get('dataUrl') or obj.get('imageUrl') or obj.get('src')
                    if data:
                        match = re.fullmatch(r'data:image/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)', data)
                        if not match:
                            raise ArchiveError('Formato fotografia non supportato.')
                        raw = base64.b64decode(match[2], validate=True)
                        relative = f'{base}/foto/{hashlib.sha256(raw).hexdigest()}.{match[1]}'
                        existing = self.safe_path(relative)
                        if existing.exists():
                            if existing.read_bytes() != raw:
                                raise ArchiveError('Integrità fotografia non valida.', 503)
                        else:
                            stage(relative, raw)
                        obj['archivePhoto'] = {'path': relative, 'mime': 'image/' + match[1]}
                        if kind == 'main' and any(photo is current for current in a.get('photos', [])):
                            photo_refs[photo.get('plane')] = relative
                    for field in ('dataUrl', 'imageUrl', 'photoUrl', 'src'):
                        obj.pop(field, None)
            for item in a.get('importedFiles', []):
                relative = item['path'].replace('\\', '/')
                if relative.startswith('/') or any(part in ('', '.', '..') for part in relative.split('/')) or len(relative) > 250:
                    raise ArchiveError('Percorso allegato importato non valido.')
                content = base64.b64decode(item.pop('base64'), validate=True)
                item['archivePath'] = stage(f'{base}/allegati/{key}/{revision}/{relative}', content)
            report_path = stage(f'{base}/report/{key}-{revision}.json', json.dumps(a.get('report'), ensure_ascii=False).encode())
            snapshot = stage(f'{base}/valutazioni/{key}-{revision}.json', json.dumps(a, ensure_ascii=False).encode())
            marker = MARKER + json.dumps({'key': key, 'snapshot': snapshot, 'report': report_path})
            matches = c.execute('SELECT ID_Valutazione, Note FROM Valutazioni_Posturali WHERE ID_Paziente=? AND Note LIKE ?', (pid, MARKER + '%')).fetchall()
            eid = next((r[0] for r in matches if json.loads(r[1][len(MARKER):]).get('key') == key), None)
            columns = ['Data_Valutazione', 'Tipo_Valutazione', 'Dati_Landmark', 'Dati_Angolari', 'Referto', 'Note', *PLANES.values()]
            vals = [p.get('dataValutazione'), 'Fotografica', json.dumps([{'plane': f.get('plane'), 'annotations': f.get('annotations'), 'baseline': f.get('baseline')} for f in a.get('photos', [])]), json.dumps({'planes': a.get('planeAssessments'), 'myofascialResults': a.get('myofascialResults')}), report_path, marker, *(photo_refs.get(plane) for plane in PLANES)]
            self.check()
            if eid:
                c.execute('UPDATE Valutazioni_Posturali SET ' + ','.join(col+'=?' for col in columns) + ' WHERE ID_Valutazione=? AND ID_Paziente=?', (*vals, eid, pid))
            else:
                c.execute('INSERT INTO Valutazioni_Posturali (ID_Paziente,' + ','.join(columns) + ') VALUES (' + ','.join('?' for _ in range(len(vals)+1)) + ')', (pid, *vals))
                eid = c.execute('SELECT last_insert_rowid()').fetchone()[0]
            if anthro is not None:
                anthropometry.write_snapshot(c, pid, eid, anthro, profile_requested and existing_pid is None)
        return {'id': eid, 'archiveKey': key}

    def load(self, code, eid, revision=None):
        self.code(code)
        with self.connect() as c:
            row = c.execute('SELECT v.*, p.Codice_Clinico FROM Valutazioni_Posturali v JOIN Pazienti p ON p.ID_Paziente=v.ID_Paziente WHERE p.Codice_Clinico=? AND v.ID_Valutazione=?', (code, eid)).fetchone()
            if not row:
                raise ArchiveError('Valutazione non trovata.', 404)
            if not (row['Note'] or '').startswith(MARKER):
                raise ArchiveError('Valutazione preesistente: formato diverso, dati conservati. Creare una nuova valutazione.', 409)
            meta = json.loads(row['Note'][len(MARKER):])
            current_snapshot = meta['snapshot']
            if revision is not None:
                if not re.fullmatch(r'[a-f0-9]{32}', revision):
                    raise ArchiveError('Revisione non valida.')
                meta['snapshot'] = f"{code}/valutazioni/{meta['key']}-{revision}.json"
                meta['report'] = f"{code}/report/{meta['key']}-{revision}.json"
            if not meta['snapshot'].startswith(code + '/valutazioni/'):
                raise ArchiveError('Riferimento valutazione non valido.')
            try:
                a = json.loads(self.safe_path(meta['snapshot']).read_text())
            except FileNotFoundError:
                raise ArchiveError('Documento della valutazione non disponibile sul Lexar.', 503)
            if a.get('archiveKey') != meta['key'] or a.get('patient', {}).get('id') != code:
                raise ArchiveError('Associazione paziente/valutazione non coerente. Nessun dato sostituito.', 409)
            if revision is not None and meta['snapshot'] != current_snapshot:
                a['recoveredRevision'] = revision
            a['evaluationId'] = eid
            a['loadedRevision'] = Path(meta['snapshot']).stem.removeprefix(meta['key']+'-')
            if not meta['report'].startswith(code + '/report/'):
                raise ArchiveError('Riferimento report non valido.')
            try:
                archived_report = json.loads(self.safe_path(meta['report']).read_text())
            except (FileNotFoundError, ValueError):
                raise ArchiveError('Report archiviato non disponibile o non leggibile sul Lexar.', 503)
            if archived_report != a.get('report'):
                raise ArchiveError('Report e valutazione archiviati non coerenti. Dati conservati: verificare le revisioni.', 503)
            report_photos = (a.get('report') or {}).get('photographs', [])
            for photo in [*a.get('photos', []), *report_photos]:
                for obj in (photo, photo.get('baseline')):
                    if obj and obj.get('archivePhoto'):
                        ref = obj.pop('archivePhoto')
                        if not ref['path'].startswith(code + '/foto/'):
                            raise ArchiveError('Riferimento foto non valido.')
                        try:
                            obj['dataUrl'] = 'data:' + ref['mime'] + ';base64,' + base64.b64encode(self.safe_path(ref['path']).read_bytes()).decode()
                        except FileNotFoundError:
                            raise ArchiveError('Fotografia archiviata non disponibile sul Lexar. Nessun dato sostituito.', 503)
            for item in a.get('importedFiles', []):
                path = item.pop('archivePath')
                if not path.startswith(code + '/allegati/'):
                    raise ArchiveError('Riferimento allegato non valido.')
                try:
                    item['base64'] = base64.b64encode(self.safe_path(path).read_bytes()).decode()
                except FileNotFoundError:
                    raise ArchiveError('Allegato importato non disponibile sul Lexar.', 503)
            patient = c.execute('SELECT * FROM Pazienti WHERE Codice_Clinico=?', (code,)).fetchone()
            a['patient'].update({k: v for k, v in self.patient(patient).items() if k in ('id', 'codiceClinico')})
            historical = a.get('antropometriaSnapshot') if revision is not None else (anthropometry.load_snapshot(c, eid) or a.get('antropometriaSnapshot'))
            a['antropometriaSnapshot'] = historical
            if historical is not None:
                a['patient']['antropometria'] = {k: historical[k] for k in ('pesoKg', 'altezzaCm')}
                a['patient']['eta'] = historical['etaAnni'] if historical['etaAnni'] is not None else ''
                a['patient']['sesso'] = historical['sesso']
            # Legacy JSON may contain measurements even without a relational snapshot.
            # Preserve those recorded values; never backfill from today's patient profile.
            from patient_management import archived_codes
            a['patient']['archived'] = code in archived_codes(self)
            return a

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # URLs and request contents may contain clinical identifiers.

    def reply(self, status, data, cookie=None):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def dispatch(self):
        try:
            port = self.server.server_port
            if self.headers.get('Host') not in (f'127.0.0.1:{port}', f'localhost:{port}'):
                raise ArchiveError('Host non consentito.', 403)
            origins = getattr(self.server, 'frontend_origins', ('http://127.0.0.1:5173', 'http://localhost:5173'))
            if self.headers.get('Origin') not in (None, *origins, f'http://127.0.0.1:{port}', f'http://localhost:{port}'):
                raise ArchiveError('Origine non consentita.', 403)
            if self.headers.get('X-Clinical-App') != '1':
                raise ArchiveError('Richiesta non autorizzata.', 403)
            url = urlsplit(self.path)
            if url.path == '/api/health' and self.command == 'GET':
                return self.reply(200, {'service': 'postural-local', 'version': 2, 'build': getattr(self.server, 'build_id', 'test')})
            data = None
            if self.command in ('POST', 'PUT'):
                size = int(self.headers.get('Content-Length', '0'))
                if size < 1 or size > 100 * 1024 * 1024:
                    raise ArchiveError('Dimensione richiesta non consentita.', 413)
                data = json.loads(self.rfile.read(size))
            if url.path == '/api/session' and self.command == 'POST':
                expected = os.environ.get('CLINICAL_PASSWORD_HASH')
                if expected:
                    salt, digest = expected.split(':')
                    actual = hashlib.scrypt(str(data.get('password', '')).encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
                    if not hmac.compare_digest(actual, digest):
                        raise ArchiveError('Credenziali non valide.', 401)
                self.server.archive.check()
                self.server.session_until = time.monotonic() + 8 * 3600
                with self.server.archive.connect() as c:
                    anthropometry_ready = anthropometry.ready(c)
                return self.reply(200, {'ready': True, 'anthropometryReady': anthropometry_ready}, 'clinical_session=' + self.server.token + '; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800')
            cookies = self.headers.get('Cookie', '').split('; ')
            if time.monotonic() > self.server.session_until or not any(hmac.compare_digest(s, 'clinical_session=' + self.server.token) for s in cookies):
                raise ArchiveError('Sessione richiesta.', 401)
            archive = self.server.archive
            if url.path == '/api/ai/synthpose/status' and self.command == 'GET':
                result = SYNTHPOSE_SERVICE.model_info()
            elif url.path == '/api/ai/synthpose' and self.command == 'POST':
                result = SYNTHPOSE_SERVICE.predict(data)
            elif url.path == '/api/patient-directory' and self.command == 'GET':
                q = parse_qs(url.query)
                result = archive.patient_directory(q.get('q', [''])[0], q.get('offset', ['0'])[0], q.get('limit', ['25'])[0], q.get('archived', ['false'])[0] == 'true')
            elif url.path.startswith('/api/patients/') and self.command == 'GET':
                result = archive.get_patient(unquote(url.path.removeprefix('/api/patients/')))
            elif url.path == '/api/patient-management' and self.command == 'POST':
                from patient_management import manage
                result = manage(archive, data)
            elif url.path == '/api/assessment-revisions' and self.command == 'GET':
                q = parse_qs(url.query)
                result = archive.revisions(q['patient'][0], int(q['id'][0]))
            elif url.path == '/api/imports/preview' and self.command == 'POST':
                result = archive.preview_import(data['patient'])
            elif url.path == '/api/imports' and self.command == 'POST':
                result = archive.save(data['assessment'], data['confirmation'])
            elif url.path == '/api/patients' and self.command == 'GET':
                result = archive.patients(parse_qs(url.query).get('q', [''])[0])
            elif url.path == '/api/patients' and self.command in ('POST', 'PUT'):
                result = archive.save_patient(data, self.command == 'POST')
            elif url.path == '/api/assessments' and self.command == 'POST':
                result = archive.save(data)
            elif url.path == '/api/assessments' and self.command == 'GET':
                q = parse_qs(url.query)
                code = q['patient'][0]
                result = archive.load(code, int(q['id'][0]), q.get('revision', [None])[0]) if 'id' in q else archive.evaluations(code)
            else:
                raise ArchiveError('Operazione non disponibile.', 404)
            self.reply(200, result)
        except SynthPoseError as error:
            self.reply(error.status, {'error': str(error), 'reason': error.reason})
        except ArchiveError as error:
            self.reply(error.status, {'error': str(error)})
        except sqlite3.IntegrityError:
            self.reply(409, {'error': 'Conflitto nei dati: verificare il codice clinico.'})
        except (KeyError, ValueError, TypeError):
            self.reply(400, {'error': 'Richiesta non valida.'})
        except Exception:
            self.reply(503, {'error': 'Archivio non disponibile o salvataggio fallito. Verificare il Lexar e i permessi.'})

    do_GET = dispatch
    do_POST = dispatch
    do_PUT = dispatch


def main():
    required = ('CLINICAL_DB_PATH', 'CLINICAL_FILES_ROOT', 'CLINICAL_VOLUME')
    if not all(os.environ.get(k) for k in required):
        raise SystemExit('Configurare CLINICAL_DB_PATH, CLINICAL_FILES_ROOT e CLINICAL_VOLUME. Nessun archivio predefinito.')
    port = int(os.environ.get('CLINICAL_PORT', '8765'))
    origin = os.environ.get('CLINICAL_FRONTEND_ORIGIN', 'http://127.0.0.1:5173')
    parsed_origin = urlsplit(origin)
    if parsed_origin.scheme != 'http' or parsed_origin.hostname not in ('127.0.0.1', 'localhost') or parsed_origin.path:
        raise SystemExit('Origine frontend deve essere HTTP localhost.')
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.build_id = hashlib.sha256(b''.join((Path(__file__).parent / name).read_bytes() for name in ('server.py', 'anthropometry.py', 'patient_management.py', 'synthpose_service.py'))).hexdigest()
    server.frontend_origins = (origin, origin.replace('127.0.0.1', 'localhost'))
    server.archive = Archive(*(os.environ[k] for k in required))
    server.token = secrets.token_urlsafe(32)
    server.session_until = 0
    print(f'Backend clinico attivo su http://127.0.0.1:{port} (solo locale).')
    server.serve_forever()

if __name__ == '__main__':
    main()
