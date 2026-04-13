from pathlib import Path

# Allow `import ml_engine.<submodule>` to resolve against the hyphenated
# project root directory on Windows.
__path__ = [str(Path(__file__).resolve().parent)]
