"""Offline pose estimation only. No archive access, clinical interpretation or downloads."""
import base64
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import re
import threading

MODEL_ID = 'stanfordmimi/synthpose-vitpose-base-hf'
KEYPOINT_NAMES = (
    'Nose', 'L_Eye', 'R_Eye', 'L_Ear', 'R_Ear', 'L_Shoulder', 'R_Shoulder',
    'L_Elbow', 'R_Elbow', 'L_Wrist', 'R_Wrist', 'L_Hip', 'R_Hip', 'L_Knee',
    'R_Knee', 'L_Ankle', 'R_Ankle', 'sternum', 'rshoulder', 'lshoulder',
    'r_lelbow', 'l_lelbow', 'r_melbow', 'l_melbow', 'r_lwrist', 'l_lwrist',
    'r_mwrist', 'l_mwrist', 'r_ASIS', 'l_ASIS', 'r_PSIS', 'l_PSIS', 'r_knee',
    'l_knee', 'r_mknee', 'l_mknee', 'r_ankle', 'l_ankle', 'r_mankle',
    'l_mankle', 'r_5meta', 'l_5meta', 'r_toe', 'l_toe', 'r_big_toe',
    'l_big_toe', 'l_calc', 'r_calc', 'C7', 'L2', 'T11', 'T6',
)
PLANES = {'frontale_anteriore', 'frontale_posteriore', 'sagittale_destro', 'sagittale_sinistro', 'trasverso'}


class SynthPoseError(Exception):
    def __init__(self, message, status=503, reason='inference_failed'):
        super().__init__(message)
        self.status = status
        self.reason = reason


def model_directory():
    value = os.environ.get('SYNTHPOSE_MODEL_DIR', '').strip()
    if not value or not Path(value).is_absolute():
        raise SynthPoseError('Configurare SYNTHPOSE_MODEL_DIR con una directory assoluta esterna al progetto.', reason='model_not_configured')
    directory = Path(value).resolve()
    if directory.is_relative_to(Path(__file__).resolve().parent.parent):
        raise SynthPoseError('Il modello deve risiedere fuori dal repository.', reason='invalid_model_path')
    # Do not create a replacement directory when an external /Volumes disk is absent.
    if directory.parts[:2] == ('/', 'Volumes') and len(directory.parts) > 2:
        volume = Path(*directory.parts[:3])
        if not volume.is_mount():
            raise SynthPoseError('Lexar/volume del modello non montato. Collegarlo prima di usare SynthPose.', reason='volume_not_mounted')
    return directory


def validate_model_files(directory):
    if not directory.is_dir():
        raise SynthPoseError('SynthPose non installato. Eseguire backend/download_synthpose.py.', reason='model_not_found')
    required = ('config.json', 'preprocessor_config.json')
    if any(not (directory / name).is_file() for name in required):
        raise SynthPoseError('SynthPose incompleto: config o image processor mancanti. Eseguire backend/download_synthpose.py.', reason='model_incomplete')
    weights = list(directory.glob('*.safetensors'))
    if not weights:
        raise SynthPoseError('Pesi SynthPose safetensors mancanti. Eseguire backend/download_synthpose.py.', reason='model_incomplete')
    try:
        config = json.loads((directory / 'config.json').read_text())
        labels = config.get('id2label', {})
        if config.get('model_type') != 'vitpose' or [labels.get(str(i)) for i in range(52)] != list(KEYPOINT_NAMES):
            raise ValueError('Unexpected marker schema')
        json.loads((directory / 'preprocessor_config.json').read_text())
        # If sharded weights exist, verify every referenced shard before loading.
        index = directory / 'model.safetensors.index.json'
        if index.is_file():
            shards = json.loads(index.read_text())['weight_map'].values()
            if any(not (directory / shard).resolve().is_relative_to(directory) or not (directory / shard).is_file() for shard in shards):
                raise ValueError('Missing shard')
    except (ValueError, KeyError, OSError, TypeError):
        raise SynthPoseError('Configurazione SynthPose incompatibile o incompleta (attesi 52 marker).', reason='model_incompatible') from None
    return config


def confidence_thresholds():
    try:
        low = float(os.environ.get('SYNTHPOSE_MIN_CONFIDENCE', '0.50'))
        high = float(os.environ.get('SYNTHPOSE_HIGH_CONFIDENCE', '0.75'))
        if not (0 <= low <= high <= 1):
            raise ValueError()
        return {'minimum': low, 'high': high}
    except ValueError:
        raise SynthPoseError('Soglie SynthPose non valide: usare 0 ≤ minima ≤ alta ≤ 1.', reason='invalid_configuration') from None


def person_box(width, height, box=None):
    """One COCO [x,y,width,height] pixel box; replaceable without a detector dependency."""
    if box is None:
        try:
            inset = float(os.environ.get('SYNTHPOSE_BBOX_INSET', '0'))
        except ValueError:
            inset = -1
        if not 0 <= inset <= 0.2:
            raise SynthPoseError('SYNTHPOSE_BBOX_INSET deve essere tra 0 e 0.2.', reason='invalid_configuration')
        return [inset * width, inset * height, width * (1 - 2 * inset), height * (1 - 2 * inset)]
    if not isinstance(box, list) or len(box) != 4 or any(isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) for n in box):
        raise SynthPoseError('Bounding box non valida: attesi [x, y, larghezza, altezza] in pixel.', 400, 'invalid_box')
    x, y, w, h = box
    if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > width or y + h > height:
        raise SynthPoseError('Bounding box esterna alla fotografia o vuota.', 400, 'invalid_box')
    return box


def serialize_keypoints(keypoints, scores, width, height):
    if len(keypoints) != 52 or len(scores) != 52 or width <= 0 or height <= 0:
        raise SynthPoseError('Output SynthPose incompatibile: attesi 52 keypoint.', reason='invalid_output')
    result = []
    for index, (point, score) in enumerate(zip(keypoints, scores)):
        x, y, confidence = float(point[0]), float(point[1]), float(score)
        if not all(math.isfinite(v) for v in (x, y, confidence)):
            raise SynthPoseError('Coordinate SynthPose non valide.', reason='invalid_output')
        # Raw out-of-frame points remain visible in debug; the adapter rejects them.
        result.append({'index': index, 'name': KEYPOINT_NAMES[index], 'xPx': x, 'yPx': y,
                       'xNormalized': x / width, 'yNormalized': y / height,
                       'confidence': max(0.0, min(1.0, confidence))})
    return result


def decode_image(data_url):
    if not isinstance(data_url, str) or len(data_url) > 40 * 1024 * 1024:
        raise SynthPoseError('Fotografia mancante o troppo grande (massimo 30 MB codificati).', 413, 'invalid_image')
    match = re.fullmatch(r'data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\r\n]+)', data_url)
    if not match:
        raise SynthPoseError('Inviare una fotografia PNG, JPEG o WebP incorporata, non un URL.', 400, 'invalid_image')
    try:
        from PIL import Image, ImageOps
        raw = base64.b64decode(match[2], validate=True)
        with Image.open(io.BytesIO(raw)) as image:
            if image.width * image.height > 24_000_000:
                raise SynthPoseError('Immagine troppo grande: massimo 24 megapixel.', 413, 'invalid_image')
            return ImageOps.exif_transpose(image).convert('RGB')
    except ImportError:
        raise SynthPoseError('Dipendenze AI mancanti. Installare backend/requirements-ai.txt nell’ambiente Python dedicato.', reason='dependencies_missing') from None
    except SynthPoseError:
        raise
    except Exception:
        raise SynthPoseError('La fotografia non è leggibile.', 400, 'invalid_image') from None


class SynthPoseService:
    def __init__(self):
        self.processor = None
        self.model = None
        self.torch = None
        self.device = None
        self.loaded_path = None
        self.version = None
        self.lock = threading.Lock()

    def model_info(self):
        info = {'model': MODEL_ID, 'offline': True, 'loaded': self.model is not None}
        try:
            directory = model_directory()
            validate_model_files(directory)
            confidence = confidence_thresholds()
            missing = [name for name in ('torch', 'transformers', 'accelerate', 'PIL', 'numpy', 'scipy', 'huggingface_hub') if importlib.util.find_spec(name) is None]
            if missing:
                raise SynthPoseError('Dipendenze AI mancanti. Installare backend/requirements-ai.txt.', reason='dependencies_missing')
            info.update({'available': True, 'modelPath': str(directory), 'device': self.device or 'not_loaded', 'thresholds': confidence})
        except SynthPoseError as error:
            info.update({'available': False, 'reason': error.reason, 'message': str(error)})
        return info

    def is_available(self):
        return self.model_info()['available']

    def load_model(self):
        directory = model_directory()
        validate_model_files(directory)  # Also recheck external disk after a previous load.
        if self.model is not None and self.loaded_path == directory:
            return
        # Set before importing HF, and always pass local_files_only and trust_remote_code=False.
        os.environ['HF_HUB_OFFLINE'] = '1'
        os.environ['TRANSFORMERS_OFFLINE'] = '1'
        os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
        try:
            import torch
            from transformers import AutoProcessor, VitPoseForPoseEstimation
        except ImportError:
            raise SynthPoseError('Dipendenze AI mancanti. Installare backend/requirements-ai.txt.', reason='dependencies_missing') from None
        try:
            processor = AutoProcessor.from_pretrained(str(directory), local_files_only=True, trust_remote_code=False, use_fast=False)
            model = VitPoseForPoseEstimation.from_pretrained(str(directory), local_files_only=True, trust_remote_code=False, use_safetensors=True)
            device = 'mps' if torch.backends.mps.is_available() else 'cpu'
            try:
                model.to(device)
            except (RuntimeError, NotImplementedError):
                device = 'cpu'
                model.to(device)
            model.eval()
            metadata = directory / 'synthpose-install.json'
            self.version = json.loads(metadata.read_text()).get('revision', 'local-unversioned') if metadata.is_file() else 'local-unversioned'
            self.processor, self.model, self.torch = processor, model, torch
            self.device, self.loaded_path = device, directory
        except Exception:
            raise SynthPoseError('Caricamento SynthPose locale fallito. Verificare file e versioni delle dipendenze AI.', reason='model_load_failed') from None

    def _infer(self, image, box):
        inputs = self.processor(image, boxes=[[box]], return_tensors='pt').to(self.device)
        with self.torch.inference_mode():
            outputs = self.model(**inputs)
        # Postprocessing can require NumPy: explicitly move model outputs to CPU first.
        outputs.heatmaps = outputs.heatmaps.cpu()
        poses = self.processor.post_process_pose_estimation(outputs, boxes=[[box]])
        if len(poses) != 1 or len(poses[0]) != 1:
            raise SynthPoseError('SynthPose non ha restituito una singola persona.', reason='invalid_output')
        pose = poses[0][0]
        return serialize_keypoints(pose['keypoints'], pose['scores'], image.width, image.height)

    def predict(self, payload):
        if not isinstance(payload, dict) or payload.get('plane') not in PLANES:
            raise SynthPoseError('Piano anatomico non valido.', 400, 'invalid_plane')
        if payload.get('mode', 'single_person_posture_photo') != 'single_person_posture_photo':
            raise SynthPoseError('Modalità di rilevamento non supportata.', 400, 'invalid_mode')
        # Avoid accumulating simultaneous expensive requests in memory.
        if not self.lock.acquire(blocking=False):
            raise SynthPoseError('SynthPose sta elaborando un’altra fotografia. Riprovare.', 429, 'busy')
        try:
            self.load_model()
            image = decode_image(payload.get('image'))
            box = person_box(image.width, image.height, payload.get('boundingBox'))
            thresholds = confidence_thresholds()
            try:
                points = self._infer(image, box)
            except (RuntimeError, NotImplementedError, SynthPoseError) as error:
                if isinstance(error, SynthPoseError) and error.reason != 'invalid_output':
                    raise
                if self.device != 'mps':
                    raise
                self.device = 'cpu'
                self.model.to('cpu')
                points = self._infer(image, box)
            return {'model': MODEL_ID, 'modelVersion': self.version, 'device': self.device,
                    'plane': payload['plane'], 'mode': 'single_person_posture_photo',
                    'imageWidth': image.width, 'imageHeight': image.height,
                    'boundingBox': box, 'thresholds': thresholds, 'keypoints': points}
        except SynthPoseError:
            raise
        except Exception:
            raise SynthPoseError('Inferenza SynthPose non riuscita. La fotografia e i landmark manuali restano invariati.') from None
        finally:
            self.lock.release()


SERVICE = SynthPoseService()
