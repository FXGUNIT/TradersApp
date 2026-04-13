from pathlib import Path
import sys
import types

_ROOT = Path(__file__).resolve().parent

if "ml_engine" not in sys.modules:
    ml_engine = types.ModuleType("ml_engine")
    ml_engine.__file__ = str(_ROOT / "__init__.py")
    ml_engine.__package__ = "ml_engine"
    ml_engine.__path__ = [str(_ROOT)]
    sys.modules["ml_engine"] = ml_engine
