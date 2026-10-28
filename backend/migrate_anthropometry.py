"""Explicit additive migration, with an integrity-checked SQLite backup before any DDL."""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
from uuid import uuid4
import anthropometry
from server import Archive


def digest(c):
    # Logical contents, schema and existing records; no clinical contents printed or logged.
    h = hashlib.sha256()
    for line in c.iterdump():
        h.update(line.encode())
        h.update(b'\n')
    return h.hexdigest()


def verify(c):
    if c.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
        raise RuntimeError('Integrità SQLite non verificata. Migrazione bloccata.')
    if c.execute('PRAGMA foreign_key_check').fetchone() is not None:
        raise RuntimeError('Chiavi esterne non verificate. Migrazione bloccata.')


def migrate(archive, backup_dir):
    archive.check()
    with archive.connect():
        pass  # Validate the existing clinical schema before creating a backup or planning DDL.
    destination = Path(backup_dir).absolute()
    # Backup contains clinical data: it must stay on the configured external volume.
    if not destination.resolve().is_relative_to(archive.volume.resolve()):
        raise RuntimeError('Il backup deve risiedere sul volume clinico configurato, non sul Mac.')
    if any(p.is_symlink() for p in (destination, *destination.parents) if p.is_relative_to(archive.volume)):
        raise RuntimeError('Percorso backup con link simbolici non consentito.')
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    with closing(sqlite3.connect(archive.database.as_uri()+'?mode=rw', uri=True)) as lock:
        lock.execute('PRAGMA foreign_keys=ON')
        lock.execute('PRAGMA busy_timeout=5000')
        lock.execute('BEGIN IMMEDIATE')  # Prevent concurrent writers during backup, verification and migration.
        try:
            if anthropometry.ready(lock):
                lock.rollback()
                return None
            name = 'pre-antropometria-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid4().hex
            backup = destination/(name+'.db')
            with backup.open('xb'):
                os.chmod(backup, 0o600)
            with closing(sqlite3.connect(archive.database.as_uri()+'?mode=ro', uri=True)) as source, closing(sqlite3.connect(backup)) as target:
                source.backup(target)
            with backup.open('rb') as durable:
                os.fsync(durable.fileno())
            with closing(sqlite3.connect(backup.as_uri()+'?mode=ro', uri=True)) as checked:
                verify(checked)
                expected = digest(checked)
                if expected != digest(lock):
                    raise RuntimeError('Backup diverso dalla sorgente: migrazione bloccata.')
            receipt = {'migration': 'anthropometry-v1', 'verifiedBeforeMigration': True, 'backup': backup.name, 'backupLogicalSha256': expected, 'backupFileSha256': hashlib.sha256(backup.read_bytes()).hexdigest()}
            receipt_path = destination/(name+'.verified.json')
            with receipt_path.open('x') as f:
                os.chmod(receipt_path, 0o600)
                json.dump(receipt, f, indent=2)
                f.flush()
                os.fsync(f.fileno())
            # Only now is DDL allowed. Existing tables, rows, user_version and files are untouched.
            archive.check()
            for sql in anthropometry.DDL:
                lock.execute(sql)
            verify(lock)
            lock.commit()
            return backup
        except BaseException:
            lock.rollback()
            raise

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup-dir', required=True)
    parser.add_argument('--backend-stopped', action='store_true', required=True)
    args = parser.parse_args()
    archive = Archive(os.environ['CLINICAL_DB_PATH'], os.environ['CLINICAL_FILES_ROOT'], os.environ['CLINICAL_VOLUME'])
    result = migrate(archive, args.backup_dir)
    print('Backup verificato e migrazione completata.' if result else 'Migrazione già presente: nessuna modifica.')
