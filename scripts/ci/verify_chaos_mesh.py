from __future__ import annotations

from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
CHAOS_DIR = REPO_ROOT / "k8s" / "chaos"
SUPPORTED_KINDS = {"PodChaos", "NetworkChaos"}


def main() -> int:
    manifests = sorted(CHAOS_DIR.glob("*.yaml"))
    if not manifests:
        raise SystemExit("No Chaos Mesh manifests found in k8s/chaos")

    validated = 0
    for manifest in manifests:
        documents = [
            doc for doc in yaml.safe_load_all(manifest.read_text(encoding="utf-8")) if doc
        ]
        if not documents:
            raise SystemExit(f"{manifest} does not contain any YAML documents")

        for doc in documents:
            api_version = doc.get("apiVersion")
            kind = doc.get("kind")
            metadata = doc.get("metadata", {})
            spec = doc.get("spec", {})
            selector = spec.get("selector", {})

            if api_version != "chaos-mesh.org/v1alpha1":
                raise SystemExit(f"{manifest}: unsupported apiVersion {api_version}")
            if kind not in SUPPORTED_KINDS:
                raise SystemExit(f"{manifest}: unsupported kind {kind}")
            if metadata.get("namespace") != "tradersapp":
                raise SystemExit(f"{manifest}: metadata.namespace must be tradersapp")
            if "tradersapp" not in selector.get("namespaces", []):
                raise SystemExit(f"{manifest}: selector.namespaces must include tradersapp")
            if spec.get("mode") not in {"one", "all", "fixed", "fixed-percent", "random-max-percent"}:
                raise SystemExit(f"{manifest}: unsupported chaos mode {spec.get('mode')}")

            if kind == "PodChaos":
                if spec.get("action") != "pod-kill":
                    raise SystemExit(f"{manifest}: PodChaos action must be pod-kill")
                if "duration" not in spec:
                    raise SystemExit(f"{manifest}: PodChaos must define duration")

            if kind == "NetworkChaos":
                if spec.get("action") not in {"delay", "loss", "partition", "duplicate", "corrupt", "bandwidth"}:
                    raise SystemExit(f"{manifest}: unsupported NetworkChaos action {spec.get('action')}")
                if "target" not in spec:
                    raise SystemExit(f"{manifest}: NetworkChaos must define target selector")

            validated += 1

    print(f"Validated {validated} Chaos Mesh manifest(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
