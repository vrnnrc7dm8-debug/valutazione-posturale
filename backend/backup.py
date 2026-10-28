"""Explicit encrypted backup; requires age, never uploads data. Run with backend stopped."""
import argparse
from contextlib import closing
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tarfile
import tempfile
from server import Archive


def backup(archive, destination, recipient):
    age = shutil.which('age')
    if not age:
        raise SystemExit('Installare age prima del backup. Nessun backup in chiaro creato.')
    archive.check()
    destination = Path(destination).absolute()
    if destination.exists():
        raise SystemExit('Destinazione già esistente: sovrascrittura bloccata.')
    # All temporary clinical data stays on the configured external volume.
    with tempfile.TemporaryDirectory(prefix='.postural-backup-', dir=archive.volume) as temp:
        snapshot = Path(temp)/'valutazione_posturale.db'
        with archive.connect() as source, closing(sqlite3.connect(snapshot)) as target:
            source.backup(target)
        os.chmod(snapshot, 0o600)
        # age authenticates the encrypted output; the private key stays outside this app.
        with destination.open('xb') as output:
            os.chmod(destination, 0o600)
            process = subprocess.Popen([age, '-r', recipient], stdin=subprocess.PIPE, stdout=output)
            try:
                with tarfile.open(fileobj=process.stdin, mode='w|') as tar:
                    tar.add(snapshot, arcname='database/valutazione_posturale.db')
                    if archive.root.exists():
                        for item in archive.root.rglob('*'):
                            if item.is_symlink():
                                raise RuntimeError('Link simbolico nell’archivio: backup interrotto.')
                        tar.add(archive.root, arcname='pazienti', recursive=True)
                process.stdin.close()
                if process.wait() != 0:
                    raise RuntimeError('Cifratura backup fallita.')
            except BaseException:
                process.kill()
                process.wait()
                destination.unlink(missing_ok=True)
                raise

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination')
    parser.add_argument('--recipient', required=True, help='Chiave pubblica age; custodire separatamente la chiave privata')
    parser.add_argument('--backend-stopped', action='store_true', required=True)
    args = parser.parse_args()
    archive = Archive(os.environ['CLINICAL_DB_PATH'], os.environ['CLINICAL_FILES_ROOT'], os.environ['CLINICAL_VOLUME'])
    backup(archive, args.destination, args.recipient)
    print('Backup cifrato completato.')
