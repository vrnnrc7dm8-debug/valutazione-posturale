"""Only synthetic fixtures. Never opens the operational database or reads .env."""
import os
from pathlib import Path
import secrets
import sqlite3
import sys
from http.server import HTTPServer
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from server import Archive, Handler
from test_archive import SCHEMA
from anthropometry import DDL

root = Path(os.environ.get('POSTURAL_E2E_ROOT', '/private/tmp/.postural-e2e-local')).absolute()
if not root.name.startswith('.postural-e2e-') or root.is_symlink():
    raise SystemExit('Test root must be an isolated .postural-e2e-* directory.')
marker = root / '.synthetic-tests-only'
if root.exists() and not marker.is_file():
    raise SystemExit('Refusing an existing directory without a synthetic-test marker.')
root.mkdir(parents=True, exist_ok=True)
marker.touch()
database = root / 'synthetic.db'
if not database.exists():
    with sqlite3.connect(database) as connection:
        connection.executescript(SCHEMA)
        for statement in DDL:
            connection.execute(statement)
volume = Path('/Volumes/Lexar') if root.is_relative_to('/Volumes/Lexar') else root
archive = Archive(database, root / 'pazienti', volume, require_mount=volume == Path('/Volumes/Lexar'))
# Test-only outage simulation, never unmounts the actual drive.
class TestHandler(Handler):
    def do_POST(self):
        if self.path in ('/test/disconnect', '/test/reconnect') and self.headers.get('Host') == '127.0.0.1:8766' and self.headers.get('X-Synthetic-Test') == '1':
            archive.volume = root / 'absent-volume' if self.path.endswith('disconnect') else volume
            self.reply(200, {'ok': True})
        else:
            self.dispatch()
os.environ.pop('CLINICAL_PASSWORD_HASH', None)
server = HTTPServer(('127.0.0.1', 8766), TestHandler)
server.archive = archive
server.token = secrets.token_urlsafe(32)
server.session_until = 0
server.frontend_origins = ('http://127.0.0.1:5174',)
archive.check()
server.serve_forever()
