"""Synthetic structural tests: neither weights nor Internet are needed."""
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from synthpose_service import (KEYPOINT_NAMES, SynthPoseError, SynthPoseService, model_directory,
                               serialize_keypoints, person_box, validate_model_files, decode_image)


class SynthPoseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.directory = Path(self.tmp.name).resolve()
        self.env = patch.dict(os.environ, {'SYNTHPOSE_MODEL_DIR': str(self.directory)}, clear=True)
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def model_files(self):
        (self.directory / 'config.json').write_text(json.dumps({'model_type': 'vitpose', 'id2label': dict(enumerate(KEYPOINT_NAMES))}))
        (self.directory / 'preprocessor_config.json').write_text('{}')
        (self.directory / 'model.safetensors').write_bytes(b'synthetic-only')

    def test_52_keypoints_and_normalization(self):
        points = serialize_keypoints([[50, 25]] * 52, [0.8] * 52, 200, 100)
        self.assertEqual(len(points), 52)
        self.assertEqual(points[48], {'index': 48, 'name': 'C7', 'xPx': 50., 'yPx': 25., 'xNormalized': .25, 'yNormalized': .25, 'confidence': .8})
        for keys, scores in [([[0, 0]], [1]), ([[float('nan'), 0]] * 52, [1] * 52)]:
            with self.assertRaises(SynthPoseError):
                serialize_keypoints(keys, scores, 200, 100)

    def test_box_is_coco_pixels_and_configurable(self):
        self.assertEqual(person_box(200, 400), [0, 0, 200, 400])
        self.assertEqual(person_box(200, 400, [10, 20, 150, 350]), [10, 20, 150, 350])
        with patch.dict(os.environ, {'SYNTHPOSE_BBOX_INSET': '0.05'}):
            self.assertEqual(person_box(200, 400), [10, 20, 180, 360])
        for box in [[-1, 0, 10, 10], [0, 0, 0, 1], [0, 0, 300, 400], [float('nan'), 0, 1, 1]]:
            with self.assertRaises(SynthPoseError):
                person_box(200, 400, box)

    def test_missing_model_is_controlled_and_does_not_create_directories(self):
        missing = self.directory / 'not-created'
        with patch.dict(os.environ, {'SYNTHPOSE_MODEL_DIR': str(missing)}):
            service = SynthPoseService()
            info = service.model_info()
            self.assertFalse(info['available'])
            self.assertEqual(info['reason'], 'model_not_found')
            with self.assertRaisesRegex(SynthPoseError, 'download_synthpose.py'):
                service.predict({'plane': 'frontale_anteriore', 'image': 'anything'})
            self.assertFalse(missing.exists())

    def test_refuses_repository_paths_and_unmounted_volume(self):
        with patch.dict(os.environ, {'SYNTHPOSE_MODEL_DIR': str(Path(__file__).resolve().parent / 'models')}):
            with self.assertRaises(SynthPoseError):
                model_directory()
        with patch.dict(os.environ, {'SYNTHPOSE_MODEL_DIR': '/Volumes/Test-Synthpose-Unmounted/models'}):
            with patch.object(Path, 'is_mount', return_value=False), self.assertRaises(SynthPoseError):
                model_directory()

    def test_incomplete_or_wrong_model_schema(self):
        self.model_files()
        validate_model_files(self.directory)
        (self.directory / 'preprocessor_config.json').unlink()
        with self.assertRaises(SynthPoseError):
            validate_model_files(self.directory)
        self.model_files()
        (self.directory / 'config.json').write_text('{"model_type":"other"}')
        with self.assertRaises(SynthPoseError):
            validate_model_files(self.directory)

    def test_local_loader_mps_and_cache_no_network(self):
        self.model_files()
        torch = MagicMock()
        torch.backends.mps.is_available.return_value = True
        transformers = MagicMock()
        with patch.dict('sys.modules', {'torch': torch, 'transformers': transformers}), patch('socket.create_connection', side_effect=AssertionError('NETWORK FORBIDDEN')):
            service = SynthPoseService()
            service.load_model()
            service.load_model()
            self.assertEqual(service.device, 'mps')
            processor = transformers.AutoProcessor.from_pretrained
            loader = transformers.VitPoseForPoseEstimation.from_pretrained
            processor.assert_called_once_with(str(self.directory), local_files_only=True, trust_remote_code=False)
            loader.assert_called_once_with(str(self.directory), local_files_only=True, trust_remote_code=False, use_safetensors=True)
            self.assertEqual(os.environ['HF_HUB_OFFLINE'], '1')

    def test_cpu_when_mps_unavailable_or_load_operation_fails(self):
        self.model_files()
        for mps in (False, True):
            torch = MagicMock()
            torch.backends.mps.is_available.return_value = mps
            transformers = MagicMock()
            model = transformers.VitPoseForPoseEstimation.from_pretrained.return_value
            if mps:
                model.to.side_effect = [RuntimeError('unsupported on MPS'), None]
            with patch.dict('sys.modules', {'torch': torch, 'transformers': transformers}):
                service = SynthPoseService()
                service.load_model()
                self.assertEqual(service.device, 'cpu')
                model.to.assert_called_with('cpu')

    def test_predict_falls_back_to_cpu_on_mps_error(self):
        service = SynthPoseService()
        service.device, service.model, service.version = 'mps', MagicMock(), 'synthetic'
        image = SimpleNamespace(width=200, height=400)
        output = serialize_keypoints([[1, 2]] * 52, [.8] * 52, 200, 400)
        with patch.object(service, 'load_model'), patch('synthpose_service.decode_image', return_value=image), patch.object(service, '_infer', side_effect=[NotImplementedError('MPS'), output]) as infer:
            result = service.predict({'plane': 'frontale_posteriore', 'image': 'synthetic'})
            self.assertEqual(infer.call_count, 2)
            self.assertEqual(result['device'], 'cpu')
            self.assertEqual(result['keypoints'], output)
            self.assertNotIn('diagnosis', result)

    def test_only_inline_images_no_urls_or_paths(self):
        for image in ['https://example.com/photo.jpg', '/tmp/photo.jpg', 'data:text/plain;base64,WA==']:
            with self.assertRaises(SynthPoseError):
                decode_image(image)

    def test_rejects_parallel_inference(self):
        service = SynthPoseService()
        service.lock.acquire()
        try:
            with self.assertRaises(SynthPoseError) as error:
                service.predict({'plane': 'frontale_anteriore'})
            self.assertEqual(error.exception.status, 429)
        finally:
            service.lock.release()


if __name__ == '__main__':
    unittest.main()


class DownloadScriptTests(unittest.TestCase):
    def test_explicit_download_uses_external_destination_and_is_repeatable(self):
        import download_synthpose
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp).resolve() / 'installation'
            hub = MagicMock()
            def create_files(**kwargs):
                self.assertEqual(kwargs['repo_id'], 'stanfordmimi/synthpose-vitpose-base-hf')
                self.assertEqual(kwargs['local_dir'], str(directory))
                (directory / 'config.json').write_text(json.dumps({'model_type': 'vitpose', 'id2label': dict(enumerate(KEYPOINT_NAMES))}))
                (directory / 'preprocessor_config.json').write_text('{}')
                (directory / 'model.safetensors').write_bytes(b'synthetic-only')
            hub.snapshot_download.side_effect = create_files
            with patch.dict(os.environ, {'SYNTHPOSE_MODEL_DIR': str(directory)}, clear=True), patch.dict('sys.modules', {'huggingface_hub': hub}), patch('builtins.print') as output:
                self.assertEqual(download_synthpose.main(), 0)
                self.assertEqual(download_synthpose.main(), 0)
                self.assertTrue((directory / 'synthpose-install.json').is_file())
                self.assertIn('Dimensione locale totale', output.call_args.args[0])

    def test_unmounted_volume_never_downloads(self):
        import download_synthpose
        hub = MagicMock()
        with patch.dict(os.environ, {'SYNTHPOSE_MODEL_DIR': '/Volumes/TEST-NOT-MOUNTED/models'}, clear=True), patch.object(Path, 'is_mount', return_value=False), patch.dict('sys.modules', {'huggingface_hub': hub}), patch('builtins.print'):
            self.assertEqual(download_synthpose.main(), 1)
            hub.snapshot_download.assert_not_called()


    def test_metadata_ignores_appledouble_non_utf8_and_unreadable_files(self):
        import download_synthpose
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp).resolve()
            metadata_dir = directory / '.cache' / 'huggingface' / 'download'
            metadata_dir.mkdir(parents=True)
            (metadata_dir / 'config.json.metadata').write_text('resolved-test-revision\netag\n', encoding='utf-8')
            (metadata_dir / '._config.json.metadata').write_bytes(b'\x00\xff\xfeAppleDouble')
            (metadata_dir / 'invalid.metadata').write_bytes(b'\xff\xfe')
            (metadata_dir / 'unreadable.metadata').write_text('ignored', encoding='utf-8')
            (metadata_dir / 'empty.metadata').write_text('', encoding='utf-8')
            original_read_text = Path.read_text

            def read_metadata(path, *args, **kwargs):
                if path.name.startswith('._'):
                    raise AssertionError('AppleDouble files must not be read')
                if path.name == 'unreadable.metadata':
                    raise OSError('Synthetic unreadable metadata')
                return original_read_text(path, *args, **kwargs)

            hub = MagicMock()
            with patch.dict(os.environ, {'SYNTHPOSE_MODEL_DIR': str(directory)}, clear=True), patch.dict('sys.modules', {'huggingface_hub': hub}), patch('download_synthpose.validate_model_files'), patch.object(Path, 'read_text', read_metadata), patch('builtins.print'):
                self.assertEqual(download_synthpose.main(), 0)
                result = json.loads((directory / 'synthpose-install.json').read_text())
                self.assertEqual(result['revision'], 'resolved-test-revision')
                hub.snapshot_download.assert_called_once()
