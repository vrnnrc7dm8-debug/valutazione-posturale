import json
import unittest
from patient_management import manage, archived_codes
from server import ArchiveError
import test_archive

class ManagementTests(unittest.TestCase):
    setUp = test_archive.ArchiveTests.setUp
    tearDown = test_archive.ArchiveTests.tearDown
    assessment = test_archive.ArchiveTests.assessment
    def test_archive_restore_keeps_data_and_filters_directory(self):
        eid = self.archive.save(self.assessment())['id']
        manage(self.archive, {'code': 'TEST-001', 'action': 'archive'})
        self.assertEqual(self.archive.patient_directory()['total'], 0)
        self.assertEqual(self.archive.patient_directory(archived=True)['total'], 1)
        self.assertEqual(self.archive.load('TEST-001', eid)['report'], {'test': True})
        with self.assertRaises(ArchiveError): self.archive.save(self.assessment())
        manage(self.archive, {'code': 'TEST-001', 'action': 'restore'})
        status = self.root/'pazienti/.patient-status/TEST-001'
        (status/'._metadata.json').write_bytes(b'\x00\xb0Mac metadata')
        self.assertNotIn('TEST-001', archived_codes(self.archive))
        self.assertEqual(self.archive.patient_directory()['patients'][0]['evaluationCount'], 1)

    def test_delete_requires_verified_backup_and_explicit_code(self):
        self.archive.save(self.assessment())
        with self.assertRaises(ArchiveError): manage(self.archive, {'code': 'TEST-001', 'action': 'delete'})
        backup = manage(self.archive, {'code': 'TEST-001', 'action': 'prepare-delete'})
        self.assertTrue(backup['verified'])
        request = {'code': 'TEST-001', 'action': 'delete', 'backupId': backup['backupId'], 'confirmation': 'ELIMINA TEST-001'}
        manage(self.archive, request)
        self.assertEqual(self.archive.patient_directory()['total'], 0)
        self.assertTrue((self.root/'pazienti/TEST-001/foto').is_dir())
        self.assertTrue((self.root/'pazienti/.verified-backups'/backup['backupId']/'database.db').is_file())

    def test_changed_archive_and_corrupt_backup_block_delete(self):
        self.archive.save(self.assessment())
        backup = manage(self.archive, {'code': 'TEST-001', 'action': 'prepare-delete'})
        self.patient['nome'] = 'Modifica sintetica'
        self.archive.save_patient(self.patient)
        with self.assertRaises(ArchiveError): manage(self.archive, {'code': 'TEST-001', 'action': 'delete', 'backupId': backup['backupId'], 'confirmation': 'ELIMINA TEST-001'})
        self.assertEqual(self.archive.patient_directory()['total'], 1)

    def test_recover_complete_revision_without_replacing_current(self):
        complete = self.assessment()
        base = complete['photos'][0]
        complete['photos'] = []
        for plane, count in zip(('frontale_anteriore','frontale_posteriore','sagittale_destro','sagittale_sinistro','trasverso'), (18,21,8,14,6)):
            photo = json.loads(json.dumps(base)); photo['plane'] = plane
            photo['annotations']['landmarks'] = {'manual': [{'id': str(i), 'position': {'x': 0.4, 'y': 0.5}} for i in range(count)]}
            complete['photos'].append(photo)
        complete['planeAssessments'] = [{'alterations': list(range(29))}]
        eid = self.archive.save(complete)['id']
        empty = self.assessment(); empty['photos'] = []; empty['report'] = None; empty['planeAssessments'] = []
        self.archive.save(empty)
        revisions = self.archive.revisions('TEST-001', eid)
        old = next(v for v in revisions if not v['current'])
        loaded = self.archive.load('TEST-001', eid, old['revision'])
        self.assertEqual(len(loaded['photos']), 5)
        self.assertEqual(len({p['plane'] for p in loaded['photos']}), 5)
        self.assertEqual(sum(len(p['annotations']['landmarks']['manual']) for p in loaded['photos']), 67)
        self.assertEqual(len(loaded['planeAssessments'][0]['alterations']), 29)
        self.assertEqual(loaded['report'], {'test': True})
        self.assertIn('recoveredRevision', loaded)
        with self.assertRaises(ArchiveError): self.archive.save(loaded)
        self.assertEqual(self.archive.load('TEST-001', eid)['photos'], [])

    def test_wrong_association_and_unknown_dependency_block(self):
        eid = self.archive.save(self.assessment())['id']
        with self.archive.connect() as c:
            c.execute('CREATE TABLE ExtraClinico (ID INTEGER PRIMARY KEY, ID_Paziente INTEGER REFERENCES Pazienti(ID_Paziente))')
            c.execute('INSERT INTO ExtraClinico VALUES (1,1)')
        with self.assertRaises(ArchiveError): manage(self.archive, {'code': 'TEST-001', 'action': 'prepare-delete'})
        with self.archive.connect() as c:
            note = c.execute('SELECT Note FROM Valutazioni_Posturali WHERE ID_Valutazione=?',(eid,)).fetchone()[0]
        meta = json.loads(note.split(':',1)[1]); path = self.archive.safe_path(meta['snapshot']); a=json.loads(path.read_text());a['patient']['id']='OTHER';path.write_text(json.dumps(a))
        with self.assertRaises(ArchiveError): self.archive.load('TEST-001', eid)

    def test_homonyms_require_explicit_confirmation(self):
        self.archive.save(self.assessment())
        new = self.assessment(); new['patient']['id'] = 'TEST-002';new['archiveKey']='f'*32
        self.assertEqual(len(self.archive.preview_import(new['patient'])['candidates']), 1)
        with self.assertRaises(ArchiveError): self.archive.save(new)
        new['allowHomonym'] = True
        self.archive.save(new)
        self.assertEqual(self.archive.patient_directory()['total'], 2)

    def test_management_uses_error_class_of_running_server_entrypoint(self):
        import runpy
        namespace = runpy.run_path(str(__import__('pathlib').Path(__file__).with_name('server.py')), run_name='server-entrypoint-regression')
        self.archive.save_patient(self.patient)
        other = namespace['Archive'](self.db, self.root/'pazienti', self.root, require_mount=False)
        with self.assertRaises(namespace['ArchiveError']):
            manage(other, {'code': 'TEST-001', 'action': 'unsupported'})

    def test_legacy_json_measurements_are_not_discarded_without_relational_snapshot(self):
        eid = self.archive.save(self.assessment())['id']
        with self.archive.connect() as c:
            note = c.execute('SELECT Note FROM Valutazioni_Posturali WHERE ID_Valutazione=?', (eid,)).fetchone()[0]
        path = self.archive.safe_path(json.loads(note.split(':', 1)[1])['snapshot'])
        a = json.loads(path.read_text())
        a['patient']['antropometria'] = {'pesoKg': 70, 'altezzaCm': 175}
        path.write_text(json.dumps(a))
        reopened = self.archive.load('TEST-001', eid)
        self.assertEqual(reopened['patient']['antropometria'], {'pesoKg': 70, 'altezzaCm': 175})
        self.assertIsNone(reopened['antropometriaSnapshot'])
