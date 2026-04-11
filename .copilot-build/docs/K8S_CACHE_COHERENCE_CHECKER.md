# K8S Cache Coherence Checker

`scripts/k8s/check-cache-coherence.py` is a standalone, read-only harness for TODO 53.

It:

1. Calls `POST /cache/invalidate`
2. Runs repeated sequential reads against the configured read endpoint
3. Runs a second invalidation and then concurrent reads
4. Compares normalized responses so cache metadata does not trigger false mismatches

## Usage

```bash
python scripts/k8s/check-cache-coherence.py
BASE_URL=http://localhost:8001 python scripts/k8s/check-cache-coherence.py
python scripts/k8s/check-cache-coherence.py --base-url http://ml-engine:8001
python scripts/k8s/check-cache-coherence.py --reads 6 --concurrency 8
```

## Defaults

- `BASE_URL` defaults to `http://localhost:8001`
- `--invalidate-path` defaults to `/cache/invalidate`
- `--read-path` defaults to `/predict`
- The checker uses only standard-library HTTP calls and does not modify cluster state beyond the read-only invalidation endpoint already exposed by the app
