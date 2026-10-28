"""Use the optional isolated AI environment; keep the archive usable without it."""
import os
from pathlib import Path
import sys

if __name__ == '__main__':
    backend = Path(__file__).resolve().parent
    isolated = backend / '.venv' / 'bin' / 'python'
    interpreter = str(isolated) if isolated.is_file() else sys.executable
    os.execv(interpreter, [interpreter, str(backend / 'server.py')])
