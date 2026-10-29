from contextlib import closing
import json
import sqlite3
import unittest
from unittest.mock import patch
import anthropometry
from migrate_anthropometry import migrate, digest
from server import ArchiveError
import test_archive


class AnthropometryTests(unittest.TestCase):
    assessment = test_archive.ArchiveTests.assessment
    def setUp(self):
        test_archive.ArchiveTests.setUp(self)
        self.backups = self.root/'backup'

    def tearDown(self):
        test_archive.ArchiveTests.tearDown(self)

    def activate(self):
        return migrate(self.archive, self.backups)

    def measured(self, key='a', measured='2026-01-10', weight=70, height=175):
        a = self.assessment()
        a['archiveKey'] = key*32
        a['patient'].update({'eta': 35, 'dataValutazione': measured, 'antropometria': {'pesoKg': weight, 'altezzaCm': height}})
        return a

    def test_demographics_update_preserves_profile_history_and_patient_links(self):
        self.activate()
        a = self.measured()
        eid = self.archive.save(a)['id']
        before = self.archive.load(self.patient['id'], eid)
        revisions = self.archive.revisions(self.patient['id'], eid)
        files = {str(p.relative_to(self.archive.root)): p.read_bytes() for p in self.archive.root.rglob('*') if p.is_file()}
        profile = self.archive.get_patient(self.patient['id'])['antropometria']
        self.archive.save_patient({**self.patient, 'id': 'TEST-002', 'allowHomonym': True}, create=True)
        updated = self.archive.save_patient({**self.patient, 'nome': 'Corretto', 'cognome': 'Anagrafica', 'sesso': 'F', 'noteCliniche': 'Nuove note'})
        self.assertEqual(updated['id'], self.patient['id'])
        self.assertEqual(updated['nome'], 'Corretto')
        self.assertEqual(updated['cognome'], 'Anagrafica')
        self.assertEqual(updated['sesso'], 'F')
        self.assertEqual(updated['noteCliniche'], 'Nuove note')
        self.assertEqual(updated['antropometria'], profile)
        self.assertEqual(self.archive.load(self.patient['id'], eid), before)
        self.assertEqual(self.archive.revisions(self.patient['id'], eid), revisions)
        self.assertEqual({str(p.relative_to(self.archive.root)): p.read_bytes() for p in self.archive.root.rglob('*') if p.is_file()}, files)
        homonym = self.archive.save_patient(self.patient)
        self.assertEqual(homonym['homonymCount'], 1)
        self.assertEqual(len(self.archive.patients()), 2)
        self.assertEqual(self.archive.evaluations('TEST-002'), [])
        self.assertEqual(self.archive.evaluations(self.patient['id'])[0]['id'], eid)

    def test_verified_backup_and_non_destructive_migration(self):
        self.archive.save(self.assessment())
        with self.archive.connect() as c:
            before = digest(c)
        backup = self.activate()
        with closing(sqlite3.connect(backup)) as c:
            self.assertEqual(digest(c), before)
            self.assertFalse(anthropometry.ready(c))
            self.assertEqual(c.execute('PRAGMA integrity_check').fetchall(), [('ok',)])
        receipt = json.loads(next(self.backups.glob('*.verified.json')).read_text())
        self.assertTrue(receipt['verifiedBeforeMigration'])
        with self.archive.connect() as c:
            self.assertTrue(anthropometry.ready(c))
            self.assertEqual(c.execute('SELECT count(*) FROM Pazienti').fetchone()[0], 1)
            self.assertEqual(c.execute('SELECT count(*) FROM Valutazioni_Posturali').fetchone()[0], 1)
        self.assertIsNone(self.activate())
        self.assertEqual(len(list(self.backups.glob('*.db'))), 1)

    def test_migration_fails_closed_when_backup_verification_fails(self):
        with patch('migrate_anthropometry.verify', side_effect=RuntimeError('Test: backup non verificato')):
            with self.assertRaises(RuntimeError):
                self.activate()
        with self.archive.connect() as c:
            self.assertFalse(anthropometry.ready(c))

    def test_migration_rolls_back_ddl_failure(self):
        with patch.object(anthropometry, 'DDL', (anthropometry.DDL[0], 'INVALID SQL')):
            with self.assertRaises(sqlite3.Error):
                self.activate()
        with self.archive.connect() as c:
            self.assertIsNone(c.execute("SELECT name FROM sqlite_master WHERE name='Profilo_Antropometrico'").fetchone())

    def test_unmigrated_database_rejects_measurements_without_writes(self):
        with self.assertRaises(ArchiveError) as error:
            self.archive.save(self.measured())
        self.assertIn('backup verificato', str(error.exception))
        with self.archive.connect() as c:
            self.assertEqual(c.execute('SELECT count(*) FROM Pazienti').fetchone()[0], 0)
        # Original functionality remains available without anthropometry.
        self.archive.save(self.assessment())

    def test_persistence_profile_and_historical_reopening(self):
        self.activate()
        first = self.measured()
        old_id = self.archive.save(first)['id']
        newer = self.measured('b', '2026-03-15', 80, 176)
        new_id = self.archive.save(newer)['id']
        self.assertEqual(self.archive.patients()[0]['antropometria']['pesoKg'], 80)
        reopened = self.archive.load('TEST-001', old_id)
        self.assertEqual(reopened['patient']['antropometria']['pesoKg'], 70)
        self.assertEqual(reopened['antropometriaSnapshot']['dataMisurazione'], '2026-01-10')
        self.assertEqual(reopened['report']['antropometria']['pesoKg'], 70)
        self.assertAlmostEqual(reopened['report']['antropometria']['bmi'], 70/1.75**2)
        self.archive.save(reopened)
        self.assertEqual(self.archive.patients()[0]['antropometria']['pesoKg'], 80)
        self.assertEqual(self.archive.load('TEST-001', new_id)['patient']['antropometria']['pesoKg'], 80)
        history = self.archive.evaluations('TEST-001')
        self.assertEqual([r['antropometriaSnapshot']['pesoKg'] for r in history], [80, 70])
        self.assertEqual(reopened['photos'][0]['dataUrl'], first['photos'][0]['dataUrl'])

    def test_same_day_old_evaluation_and_missing_historical_values(self):
        old_id = self.archive.save(self.assessment())['id']
        self.activate()
        legacy = self.archive.load('TEST-001', old_id)
        self.assertIsNone(legacy['antropometriaSnapshot'])
        self.assertNotIn('antropometria', legacy['patient'])
        first = self.archive.save(self.measured('b'))['id']
        self.archive.save(self.measured('c', weight=90))
        self.archive.save(self.archive.load('TEST-001', first))
        self.assertEqual(self.archive.patients()[0]['antropometria']['pesoKg'], 90)
        legacy['patient']['dataValutazione'] = '2026-01-10'
        self.archive.save(legacy)
        self.assertEqual(self.archive.patients()[0]['antropometria']['pesoKg'], 90)

    def test_validation_decimal_missing_and_profile_endpoint(self):
        self.activate()
        a = self.measured(weight='70,5', height='175,5')
        eid = self.archive.save(a)['id']
        stored = self.archive.load('TEST-001', eid)
        self.assertEqual(stored['patient']['antropometria']['pesoKg'], 70.5)
        for bad in (0, -2, float('nan'), float('inf'), 501, '70kg', True):
            with self.subTest(bad=bad):
                with self.assertRaises(ArchiveError):
                    self.archive.save(self.measured(weight=bad))
        self.assertEqual(self.archive.patients()[0]['antropometria']['pesoKg'], 70.5)
        a = self.measured('c', '2026-02-01', weight=None, height=None)
        eid = self.archive.save(a)['id']
        self.assertIsNone(self.archive.load('TEST-001', eid)['report']['antropometria']['bmi'])
        p = {**self.patient, 'dataValutazione': '2026-03-01', 'antropometria': {'pesoKg': 75, 'altezzaCm': 180}}
        self.archive.save_patient(p)
        self.assertEqual(self.archive.patients()[0]['antropometria']['pesoKg'], 75)
        self.assertEqual(self.archive.load('TEST-001', 1)['patient']['antropometria']['pesoKg'], 70.5)

    def test_rollback_does_not_change_profile_or_snapshot(self):
        self.activate()
        first = self.measured()
        eid = self.archive.save(first)['id']
        broken = self.measured(weight=90)
        broken['photos'][0]['dataUrl'] = 'invalid'
        with self.assertRaises(ArchiveError):
            self.archive.save(broken)
        self.assertEqual(self.archive.load('TEST-001', eid)['antropometriaSnapshot']['pesoKg'], 70)
        self.assertEqual(self.archive.patients()[0]['antropometria']['pesoKg'], 70)

    def test_report_archived_exactly_and_preserved_when_current_measurements_change(self):
        self.activate()
        a = self.measured()
        a['inputRevision'] = 2
        a['report'] = {
            'generatedAt': '2026-01-10T10:00:00Z', 'sourceRevision': 1,
            'antropometria': {'pesoKg': 65, 'altezzaCm': 175, 'dataMisurazione': '2026-01-10', 'etaAnni': 35, 'sesso': 'M', 'bmi': 65 / 1.75**2},
            'sections': [{'plane': 'frontale_anteriore', 'autoMeasurements': ['Dislivello sintetico: 2% immagine'], 'dataAvailability': {'photoPresent': True, 'clinicalLandmarks': 2}}],
        }
        expected = json.loads(json.dumps(a['report']))
        eid = self.archive.save(a)['id']
        with self.archive.connect() as c:
            reference = c.execute('SELECT Referto FROM Valutazioni_Posturali WHERE ID_Valutazione=?', (eid,)).fetchone()[0]
        self.assertEqual(json.loads(self.archive.safe_path(reference).read_text()), expected)
        reopened = self.archive.load('TEST-001', eid)
        self.assertEqual(reopened['report'], expected)
        self.assertEqual(reopened['inputRevision'], 2)
        self.assertEqual(reopened['patient']['antropometria']['pesoKg'], 70)

if __name__ == '__main__':
    unittest.main()
