"""Opt-in real offline smoke check; no patient photographs or network required."""
import base64
import io
import os
import unittest
from unittest.mock import patch


@unittest.skipUnless(os.environ.get('SYNTHPOSE_INTEGRATION_TEST') == '1', 'Optional real model: SYNTHPOSE_INTEGRATION_TEST=1')
class SynthPoseIntegrationTest(unittest.TestCase):
    def test_real_local_weights_without_network(self):
        from PIL import Image
        from synthpose_service import SynthPoseService
        image = Image.new('RGB', (400, 800), '#808080')
        stream = io.BytesIO()
        image.save(stream, format='PNG')
        payload = {'plane': 'frontale_anteriore', 'image': 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode()}
        with patch('socket.socket.connect', side_effect=AssertionError('Inference attempted a network connection')):
            result = SynthPoseService().predict(payload)
        self.assertEqual(len(result['keypoints']), 52)
        self.assertIn(result['device'], ('mps', 'cpu'))
