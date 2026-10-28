import base64
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from server import Archive, ArchiveError

# Fixture sintetica con le stesse colonne dello schema ispezionato; mai il DB clinico.
SCHEMA = '''
CREATE TABLE Pazienti (ID_Paziente INTEGER PRIMARY KEY, Codice_Clinico TEXT UNIQUE NOT NULL, Nome TEXT, Cognome TEXT, Data_Nascita TEXT, Sesso TEXT, Telefono TEXT, Email TEXT, Professione TEXT, Note TEXT, Data_Creazione TEXT DEFAULT CURRENT_TIMESTAMP, Data_Modifica TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE Valutazioni_Posturali (ID_Valutazione INTEGER PRIMARY KEY, ID_Paziente INTEGER NOT NULL REFERENCES Pazienti(ID_Paziente) ON DELETE CASCADE, Data_Valutazione TEXT, Tipo_Valutazione TEXT, Dati_Landmark TEXT, Dati_Angolari TEXT, Referto TEXT, Note TEXT, Foto_Frontale_Anteriore TEXT, Foto_Frontale_Posteriore TEXT, Foto_Sagittale_Dx TEXT, Foto_Sagittale_Sx TEXT);
'''

class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.db = self.root / 'test.db'
        with closing(sqlite3.connect(self.db)) as c:
            c.executescript(SCHEMA)
        self.archive = Archive(self.db, self.root / 'pazienti', self.root, require_mount=False)
        self.patient = {'id': 'TEST-001', 'nome': 'Sintetico', 'cognome': 'Prova', 'sesso': 'M', 'noteCliniche': 'Solo test'}

    def tearDown(self):
        self.tmp.cleanup()

    def assessment(self):
        return {'archiveKey': 'a'*32, 'patient': self.patient.copy(), 'photos': [{'plane': 'frontale_anteriore', 'dataUrl': 'data:image/png;base64,' + base64.b64encode(b'fake test image').decode(), 'annotations': {'landmarks': [{'id': 'test', 'x': 1, 'y': 2}]}, 'baseline': {'dataUrl': 'data:image/png;base64,'+base64.b64encode(b'test baseline').decode(), 'annotations': {}}}], 'report': {'test': True}, 'planeAssessments': [{'test': 1}], 'myofascialResults': [], 'defaultSubjectHeightCm': 170}

    def test_patient_create_search_modify_unique(self):
        self.archive.save_patient(self.patient, create=True)
        self.assertEqual(len(self.archive.patients('sintetico')), 1)
        self.assertEqual(self.archive.patients("' OR 1=1 --"), [])
        self.patient['nome'] = 'Modificato'
        self.archive.save_patient(self.patient)
        self.assertEqual(self.archive.patients('TEST-001')[0]['nome'], 'Modificato')
        with self.assertRaises(ArchiveError):
            self.archive.save_patient(self.patient, create=True)

    def test_save_reopen_update_and_multiple_assessments(self):
        a = self.assessment()
        eid = self.archive.save(a)['id']
        reopened = Archive(self.db, self.root/'pazienti', self.root, False).load(self.patient['id'], eid)
        self.assertEqual(reopened['photos'][0]['dataUrl'], a['photos'][0]['dataUrl'])
        self.assertEqual(reopened['photos'][0]['baseline'], a['photos'][0]['baseline'])
        self.assertEqual(reopened['report'], a['report'])
        self.assertEqual(reopened['defaultSubjectHeightCm'], 170)
        a['report'] = {'test': 'updated'}
        self.assertEqual(self.archive.save(a)['id'], eid)
        a['archiveKey'] = 'b'*32
        self.archive.save(a)
        self.assertEqual(len(self.archive.evaluations(self.patient['id'])), 2)
        self.assertTrue((self.root/'pazienti/TEST-001/allegati').is_dir())
        with self.archive.connect() as c:
            self.assertEqual(c.execute('PRAGMA foreign_keys').fetchone()[0], 1)
            row = c.execute('SELECT * FROM Valutazioni_Posturali LIMIT 1').fetchone()
            self.assertNotIn('data:image', row['Note'])
            self.assertTrue(row['Foto_Frontale_Anteriore'].startswith('TEST-001/foto/'))

    def test_rollback_and_preserve_previous(self):
        a = self.assessment()
        eid = self.archive.save(a)['id']
        a['patient']['nome'] = 'Non deve essere salvato'
        a['photos'][0]['dataUrl'] = 'invalid'
        with self.assertRaises(ArchiveError):
            self.archive.save(a)
        self.assertEqual(self.archive.load('TEST-001', eid)['patient']['nome'], 'Sintetico')

    def test_missing_volume_and_database_no_fallback(self):
        missing = self.root/'missing'
        with self.assertRaises(ArchiveError):
            Archive(self.db, self.root/'pazienti', missing, False).save(self.assessment())
        self.db.unlink()
        with self.assertRaises(ArchiveError):
            self.archive.save_patient(self.patient)
        self.assertFalse(self.db.exists())

    def test_path_traversal_and_symlink_rejected(self):
        for value in ('../evil', '/tmp/x', 'a/b', 'a\\b', '..', ''):
            with self.assertRaises(ArchiveError):
                self.archive.save_patient({**self.patient, 'id': value})
        (self.root/'pazienti').mkdir()
        (self.root/'pazienti/TEST-001').symlink_to(self.root)
        with self.assertRaises(ArchiveError):
            self.archive.save(self.assessment())

    def test_directory_pagination_search_and_exact_lookup(self):
        for index in range(205):
            self.archive.save_patient({**self.patient, 'id': f'SYN-{index:03}', 'nome': 'Sintetico', 'cognome': f'Prova{index:03}'})
        result = self.archive.patient_directory('', 200)
        self.assertEqual(result['total'], 205)
        self.assertEqual(len(result['patients']), 5)
        self.assertEqual(self.archive.patient_directory('SYN-204')['total'], 1)
        self.assertEqual(self.archive.get_patient('SYN-204')['id'], 'SYN-204')
        with self.assertRaises(ArchiveError):
            self.archive.get_patient('ASSENTE')

    def test_import_confirmation_preserves_previous_and_documents(self):
        original = self.assessment()
        old = self.archive.save(original)['id']
        incoming = self.assessment()
        incoming.pop('archiveKey')  # Legacy export has no archive key.
        incoming['patient']['nome'] = 'Nome storico importato'
        incoming['importedFiles'] = [{'path': 'attachments/import-original/clinical/test.json', 'base64': base64.b64encode(b'{"synthetic":true}').decode()}]
        preview = self.archive.preview_import(incoming['patient'])
        result = self.archive.save(incoming, {'mode': 'new-evaluation', 'token': preview['token']})
        self.assertNotEqual(result['id'], old)
        self.assertEqual(self.archive.get_patient('TEST-001')['nome'], 'Sintetico')
        reopened = self.archive.load('TEST-001', result['id'])
        self.assertEqual(reopened['patient']['nome'], 'Nome storico importato')
        self.assertEqual(reopened['importedFiles'], incoming['importedFiles'])
        self.assertEqual(self.archive.load('TEST-001', old)['report'], original['report'])
        with self.assertRaises(ArchiveError) as error:
            self.archive.save(incoming, {'mode': 'new-evaluation', 'token': preview['token']})
        self.assertEqual(error.exception.status, 409)
        self.assertEqual(len(self.archive.evaluations('TEST-001')), 2)

    def test_missing_files_fail_without_overwriting(self):
        a = self.assessment()
        eid = self.archive.save(a)['id']
        photo = next((self.root/'pazienti/TEST-001/foto').iterdir())
        photo.unlink()
        with self.assertRaises(ArchiveError) as error:
            self.archive.load('TEST-001', eid)
        self.assertEqual(error.exception.status, 503)
        self.assertEqual(len(self.archive.evaluations('TEST-001')), 1)

    def test_missing_report_fails_without_replacing_snapshot(self):
        eid = self.archive.save(self.assessment())['id']
        next((self.root/'pazienti/TEST-001/report').iterdir()).unlink()
        with self.assertRaises(ArchiveError) as error:
            self.archive.load('TEST-001', eid)
        self.assertIn('Report archiviato', str(error.exception))
        self.assertEqual(len(self.archive.evaluations('TEST-001')), 1)

    def test_report_photo_snapshot_reopens_without_overwriting_current_photograph(self):
        a = self.assessment()
        a['report']['photographs'] = [json.loads(json.dumps(a['photos'][0]))]
        old_photo = a['photos'][0]['dataUrl']
        old_annotations = json.loads(json.dumps(a['photos'][0]['annotations']))
        a['photos'][0]['dataUrl'] = 'data:image/png;base64,' + base64.b64encode(b'new synthetic photograph').decode()
        a['photos'][0]['annotations'] = {'landmarks': []}
        eid = self.archive.save(a)['id']
        reopened = self.archive.load('TEST-001', eid)
        self.assertEqual(reopened['report']['photographs'][0]['dataUrl'], old_photo)
        self.assertEqual(reopened['report']['photographs'][0]['annotations'], old_annotations)
        self.assertEqual(reopened['photos'][0]['dataUrl'], a['photos'][0]['dataUrl'])
        with self.archive.connect() as c:
            ref = c.execute('SELECT Referto FROM Valutazioni_Posturali WHERE ID_Valutazione=?', (eid,)).fetchone()[0]
        stored = self.archive.safe_path(ref).read_text()
        self.assertNotIn('data:image', stored)
        self.assertIn('archivePhoto', stored)
        self.assertEqual(self.archive.save(reopened)['id'], eid)
        self.assertEqual(self.archive.load('TEST-001', eid)['report']['photographs'][0]['dataUrl'], old_photo)

    def test_report_photo_request_reference_is_resolved_before_archiving(self):
        a = self.assessment()
        a['report']['photographs'] = [{'plane': 'frontale_anteriore', 'reportSourcePlane': 'frontale_anteriore', 'annotations': a['photos'][0]['annotations']}]
        eid = self.archive.save(a)['id']
        reopened = self.archive.load('TEST-001', eid)
        self.assertEqual(reopened['report']['photographs'][0]['dataUrl'], a['photos'][0]['dataUrl'])
        self.assertNotIn('reportSourcePlane', reopened['report']['photographs'][0])
        a['report']['photographs'][0]['reportSourcePlane'] = '../arbitrary'
        with self.assertRaises(ArchiveError):
            self.archive.save(a)

    def test_no_schema_changes(self):
        with closing(sqlite3.connect(self.db)) as c:
            before = c.execute('SELECT sql FROM sqlite_master').fetchall()
        self.archive.save(self.assessment())
        with closing(sqlite3.connect(self.db)) as c:
            self.assertEqual(before, c.execute('SELECT sql FROM sqlite_master').fetchall())

if __name__ == '__main__':
    unittest.main()
