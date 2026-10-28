"""Explicit maintenance command. Never imported or invoked by clinical inference."""
import json
import os
from pathlib import Path
import sys
from synthpose_service import MODEL_ID, SynthPoseError, model_directory, validate_model_files


def main():
    try:
        directory = model_directory()  # Check mount before mkdir; refuse paths inside Git.
        if os.environ.get('HF_HUB_OFFLINE') == '1':
            raise SynthPoseError('Rimuovere HF_HUB_OFFLINE dalla shell per eseguire il download esplicito.')
        os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
        from huggingface_hub import snapshot_download
        directory.mkdir(parents=True, exist_ok=True)
        revision = os.environ.get('SYNTHPOSE_REVISION', 'main')
        snapshot_download(repo_id=MODEL_ID, revision=revision, local_dir=str(directory))
        validate_model_files(directory)
        # Local Hub metadata records the resolved commit; no photo is read by this script.
        revisions = set()
        for metadata in (directory / '.cache' / 'huggingface' / 'download').rglob('*.metadata'):
            lines = metadata.read_text().splitlines()
            if lines:
                revisions.add(lines[0])
        resolved = next(iter(revisions)) if len(revisions) == 1 else revision
        (directory / 'synthpose-install.json').write_text(json.dumps({'model': MODEL_ID, 'revision': resolved}, indent=2))
        size = sum(p.stat().st_size for p in directory.rglob('*') if p.is_file())
        print(f'SynthPose disponibile in: {directory}\nDimensione locale totale: {size / 1024**2:.1f} MiB\nRevisione: {resolved}')
    except (SynthPoseError, ImportError) as error:
        print(f'Installazione SynthPose: {error}', file=sys.stderr)
        return 1
    except Exception:
        print('Download SynthPose fallito. Verificare connessione, spazio sul Lexar e dipendenze. Rilanciare per riprendere.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
