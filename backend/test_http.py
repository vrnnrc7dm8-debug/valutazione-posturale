import http.client
import json
import os
import secrets
import threading
import time
import unittest
from http.server import HTTPServer
from unittest.mock import patch
from server import Handler
import test_archive

class HttpTests(unittest.TestCase):
    assessment = test_archive.ArchiveTests.assessment
    def setUp(self):
        test_archive.ArchiveTests.setUp(self)
        self.server = HTTPServer(('127.0.0.1', 0), Handler)
        self.server.archive = self.archive
        self.server.token = secrets.token_urlsafe(32)
        self.server.session_until = 0
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.cookie = ''

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        test_archive.ArchiveTests.tearDown(self)

    def request(self, method, path, data=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        h = {'Host': f'127.0.0.1:{self.server.server_port}', 'X-Clinical-App': '1', 'Cookie': self.cookie}
        h.update(headers or {})
        conn.request(method, path, body=json.dumps(data) if data is not None else None, headers=h)
        result = conn.getresponse()
        if result.getheader('Set-Cookie'):
            self.cookie = result.getheader('Set-Cookie').split(';')[0]
        status, body = result.status, json.loads(result.read())
        self.assertEqual(result.getheader('Cache-Control'), 'no-store')
        conn.close()
        return status, body

    def test_http_session_crud_and_reopen(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(self.request('GET', '/api/patients')[0], 401)
            self.assertEqual(self.request('POST', '/api/session', {})[0], 200)
            self.assertEqual(self.request('POST', '/api/patients', self.patient)[0], 200)
            self.assertEqual(self.request('POST', '/api/patients', self.patient)[0], 409)
            self.patient['nome'] = 'Aggiornato'
            self.assertEqual(self.request('PUT', '/api/patients', self.patient)[0], 200)
            self.assertEqual(self.request('GET', '/api/patients?q=Aggiornato')[1][0]['id'], 'TEST-001')
            status, result = self.request('POST', '/api/assessments', self.assessment())
            self.assertEqual(status, 200)
            self.assertEqual(self.request('GET', '/api/assessments?patient=TEST-001&id='+str(result['id']))[0], 200)
            self.assertEqual(self.request('GET', '/api/patients', headers={'Origin': 'http://evil.example'})[0], 403)
            self.assertEqual(self.request('GET', '/api/patients', headers={'Host': 'evil.example'})[0], 403)
            self.assertEqual(self.request('POST', '/api/session', {}, {'X-Clinical-App': ''})[0], 403)
            self.server.session_until = time.monotonic() - 1
            self.assertEqual(self.request('GET', '/api/patients')[0], 401)

    def test_password_and_unplugged(self):
        import hashlib
        salt = b'synthetic-salt'
        hashed = hashlib.scrypt(b'synthetic-password', salt=salt, n=16384, r=8, p=1).hex()
        with patch.dict(os.environ, {'CLINICAL_PASSWORD_HASH': salt.hex()+':'+hashed}, clear=True):
            self.assertEqual(self.request('POST', '/api/session', {'password': 'wrong'})[0], 401)
            self.assertEqual(self.request('POST', '/api/session', {'password': 'synthetic-password'})[0], 200)
            self.archive.volume = self.root/'disconnected'
            self.assertEqual(self.request('POST', '/api/assessments', self.assessment())[0], 503)

    def test_synthpose_endpoints_require_session_and_preserve_archive_routes(self):
        from synthpose_service import SynthPoseError
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(self.request('GET', '/api/ai/synthpose/status')[0], 401)
            self.assertEqual(self.request('POST', '/api/ai/synthpose', {'image': 'synthetic', 'plane': 'frontale_anteriore'})[0], 401)
            self.assertEqual(self.request('POST', '/api/session', {})[0], 200)
            with patch('server.SYNTHPOSE_SERVICE.model_info', return_value={'available': False, 'reason': 'model_not_found', 'offline': True}):
                status, info = self.request('GET', '/api/ai/synthpose/status')
                self.assertEqual(status, 200)
                self.assertFalse(info['available'])
            with patch('server.SYNTHPOSE_SERVICE.predict', side_effect=SynthPoseError('SynthPose non installato. Eseguire backend/download_synthpose.py.', reason='model_not_found')):
                status, info = self.request('POST', '/api/ai/synthpose', {'image': 'synthetic', 'plane': 'frontale_anteriore'})
                self.assertEqual(status, 503)
                self.assertEqual(info['reason'], 'model_not_found')
                self.assertNotIn('traceback', json.dumps(info).lower())
            self.assertEqual(self.request('GET', '/api/patients')[0], 200)
            with patch('server.SYNTHPOSE_SERVICE.predict', return_value={'keypoints': [], 'model': 'synthetic-only'}) as predict:
                self.assertEqual(self.request('POST', '/api/ai/synthpose', {'image': 'synthetic', 'plane': 'frontale_anteriore'})[0], 200)
                predict.assert_called_once_with({'image': 'synthetic', 'plane': 'frontale_anteriore'})
            self.assertEqual(self.request('GET', '/api/ai/synthpose/status', headers={'Origin': 'http://external.example'})[0], 403)
