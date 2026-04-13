import importlib
import sys
from importlib.machinery import ModuleSpec
from pathlib import Path

_ROOT = Path(__file__).resolve().parent

# Allow `import ml_engine.<submodule>` to resolve against the hyphenated
# project root directory on Windows.
__path__ = [str(_ROOT)]
__package__ = "ml_engine"
__spec__ = ModuleSpec("ml_engine", loader=None, is_package=True)
__spec__.submodule_search_locations = __path__

try:
    kafka = importlib.import_module("kafka")
    sys.modules.setdefault("ml_engine.kafka", kafka)
except Exception:
    pass
