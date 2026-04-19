#!/usr/bin/env python3
"""
Generate a deterministic core memory budget report from the staged minimal
TradersApp manifests produced by render-core-minimal-manifests.sh.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


APPLY_ORDER_FILE = "00-apply-order.txt"
MARKDOWN_REPORT_FILE = "05-core-budget.md"
JSON_REPORT_FILE = "05-core-budget.json"


@dataclass
class QuantitySet:
    cpu_request_mcpu: int = 0
    cpu_limit_mcpu: int = 0
    memory_request_mib: int = 0
    memory_limit_mib: int = 0
    ephemeral_request_mib: int = 0
    ephemeral_limit_mib: int = 0


@dataclass
class ServiceBudget:
    order: int
    manifest_file: str
    service: str
    resources: QuantitySet


CPU_PATTERN = re.compile(r"^([0-9]+)(m?)$")
MEMORY_PATTERN = re.compile(r"^([0-9]+)(Ki|Mi|Gi)?$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a staged core memory budget report from rendered manifests."
    )
    parser.add_argument("--manifest-dir", required=True, help="Directory containing the staged manifests.")
    parser.add_argument("--node-ram-mib", type=int, default=1024, help="Physical RAM budget for the OCI node.")
    parser.add_argument("--node-swap-mib", type=int, default=2048, help="Configured swap budget on the OCI node.")
    parser.add_argument(
        "--min-mem-available-mib",
        type=int,
        default=350,
        help="Provisional MemAvailable floor enforced before staged deploy.",
    )
    parser.add_argument(
        "--min-swap-free-mib",
        type=int,
        default=768,
        help="Provisional SwapFree floor enforced before staged deploy.",
    )
    parser.add_argument(
        "--output-markdown",
        default="",
        help=f"Optional explicit markdown output path. Defaults to <manifest-dir>/{MARKDOWN_REPORT_FILE}.",
    )
    parser.add_argument(
        "--output-json",
        default="",
        help=f"Optional explicit JSON output path. Defaults to <manifest-dir>/{JSON_REPORT_FILE}.",
    )
    return parser.parse_args()


def parse_cpu_to_mcpu(value: str) -> int:
    match = CPU_PATTERN.match(value.strip())
    if not match:
        raise ValueError(f"Unsupported CPU quantity: {value}")
    amount = int(match.group(1))
    return amount if match.group(2) == "m" else amount * 1000


def parse_memory_to_mib(value: str) -> int:
    match = MEMORY_PATTERN.match(value.strip())
    if not match:
        raise ValueError(f"Unsupported memory quantity: {value}")
    amount = int(match.group(1))
    unit = match.group(2) or "Mi"
    if unit == "Ki":
        return amount // 1024
    if unit == "Mi":
        return amount
    if unit == "Gi":
        return amount * 1024
    raise ValueError(f"Unsupported memory unit: {unit}")


def split_documents(path: Path) -> list[list[str]]:
    raw_lines = path.read_text(encoding="utf-8").splitlines()
    documents: list[list[str]] = []
    current: list[str] = []
    for line in raw_lines:
        if line.strip() == "---":
            if any(entry.strip() for entry in current):
                documents.append(current)
            current = []
            continue
        current.append(line)
    if any(entry.strip() for entry in current):
        documents.append(current)
    return documents


def extract_deployment_budget(path: Path) -> tuple[str, QuantitySet]:
    documents = split_documents(path)
    for lines in documents:
        if "kind: Deployment" not in lines:
            continue

        service = ""
        resources = QuantitySet()
        in_top_metadata = False
        found_spec = False
        in_resources = False
        current_section = ""
        resources_indent = 0

        for line in lines:
            stripped = line.strip()
            indent = len(line) - len(line.lstrip(" "))

            if not found_spec:
                if stripped == "metadata:" and indent == 0:
                    in_top_metadata = True
                    continue
                if stripped == "spec:" and indent == 0:
                    found_spec = True
                    in_top_metadata = False
                    continue
                if in_top_metadata and stripped.startswith("name:"):
                    service = stripped.split(":", 1)[1].strip()
                    continue

            if stripped == "resources:":
                in_resources = True
                current_section = ""
                resources_indent = indent
                continue

            if in_resources and indent <= resources_indent and stripped:
                in_resources = False
                current_section = ""

            if not in_resources:
                continue

            if stripped == "requests:":
                current_section = "requests"
                continue
            if stripped == "limits:":
                current_section = "limits"
                continue
            if ":" not in stripped or not current_section:
                continue

            key, raw_value = [item.strip() for item in stripped.split(":", 1)]
            if key == "cpu":
                if current_section == "requests":
                    resources.cpu_request_mcpu = parse_cpu_to_mcpu(raw_value)
                else:
                    resources.cpu_limit_mcpu = parse_cpu_to_mcpu(raw_value)
            elif key == "memory":
                if current_section == "requests":
                    resources.memory_request_mib = parse_memory_to_mib(raw_value)
                else:
                    resources.memory_limit_mib = parse_memory_to_mib(raw_value)
            elif key == "ephemeral-storage":
                if current_section == "requests":
                    resources.ephemeral_request_mib = parse_memory_to_mib(raw_value)
                else:
                    resources.ephemeral_limit_mib = parse_memory_to_mib(raw_value)

        if not service:
            raise ValueError(f"Unable to determine deployment name from {path}")
        return service, resources

    raise ValueError(f"No Deployment document found in {path}")


def format_mcpu(value: int) -> str:
    return f"{value}m"


def format_mib(value: int) -> str:
    return f"{value} MiB"


def build_report(services: list[ServiceBudget], args: argparse.Namespace) -> dict:
    totals = QuantitySet()
    for service in services:
        totals.cpu_request_mcpu += service.resources.cpu_request_mcpu
        totals.cpu_limit_mcpu += service.resources.cpu_limit_mcpu
        totals.memory_request_mib += service.resources.memory_request_mib
        totals.memory_limit_mib += service.resources.memory_limit_mib
        totals.ephemeral_request_mib += service.resources.ephemeral_request_mib
        totals.ephemeral_limit_mib += service.resources.ephemeral_limit_mib

    safe_resident_budget_mib = args.node_ram_mib - args.min_mem_available_mib
    residual_headroom_above_requests_mib = safe_resident_budget_mib - totals.memory_request_mib
    overcommit_against_safe_resident_budget_mib = totals.memory_limit_mib - safe_resident_budget_mib

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "manifestDir": str(Path(args.manifest_dir).resolve()),
        "applyOrder": [service.service for service in services],
        "nodeProfile": {
            "physicalRamMiB": args.node_ram_mib,
            "configuredSwapMiB": args.node_swap_mib,
            "preDeployMemAvailableFloorMiB": args.min_mem_available_mib,
            "preDeploySwapFreeFloorMiB": args.min_swap_free_mib,
            "safeResidentBudgetMiB": safe_resident_budget_mib,
        },
        "services": [
            {
                "order": service.order,
                "manifestFile": service.manifest_file,
                "service": service.service,
                "resources": {
                    "cpuRequestMilli": service.resources.cpu_request_mcpu,
                    "cpuLimitMilli": service.resources.cpu_limit_mcpu,
                    "memoryRequestMiB": service.resources.memory_request_mib,
                    "memoryLimitMiB": service.resources.memory_limit_mib,
                    "ephemeralRequestMiB": service.resources.ephemeral_request_mib,
                    "ephemeralLimitMiB": service.resources.ephemeral_limit_mib,
                },
            }
            for service in services
        ],
        "totals": {
            "cpuRequestMilli": totals.cpu_request_mcpu,
            "cpuLimitMilli": totals.cpu_limit_mcpu,
            "memoryRequestMiB": totals.memory_request_mib,
            "memoryLimitMiB": totals.memory_limit_mib,
            "ephemeralRequestMiB": totals.ephemeral_request_mib,
            "ephemeralLimitMiB": totals.ephemeral_limit_mib,
            "residualHeadroomAboveRequestsMiB": residual_headroom_above_requests_mib,
            "overcommitAgainstSafeResidentBudgetMiB": overcommit_against_safe_resident_budget_mib,
        },
    }


def render_markdown(report: dict) -> str:
    node = report["nodeProfile"]
    totals = report["totals"]
    lines = [
        "# Core Minimal Memory Budget",
        "",
        f"Generated: `{report['generatedAt']}`",
        f"Manifest directory: `{report['manifestDir']}`",
        f"Staged apply order: `{ ' -> '.join(report['applyOrder']) }`",
        "",
        "## Node Floor",
        "",
        "| Item | Value |",
        "|---|---:|",
        f"| Physical RAM | {format_mib(node['physicalRamMiB'])} |",
        f"| Configured swap | {format_mib(node['configuredSwapMiB'])} |",
        f"| Pre-deploy MemAvailable floor | {format_mib(node['preDeployMemAvailableFloorMiB'])} |",
        f"| Pre-deploy SwapFree floor | {format_mib(node['preDeploySwapFreeFloorMiB'])} |",
        f"| Safe resident budget after floor | {format_mib(node['safeResidentBudgetMiB'])} |",
        "",
        "## Service Envelopes",
        "",
        "| Order | Service | Request CPU | Limit CPU | Request Memory | Limit Memory | Request Ephemeral | Limit Ephemeral |",
        "|---|---|---:|---:|---:|---:|---:|---:|",
    ]

    for service in report["services"]:
        resources = service["resources"]
        lines.append(
            f"| {service['order']} | `{service['service']}` | "
            f"{format_mcpu(resources['cpuRequestMilli'])} | "
            f"{format_mcpu(resources['cpuLimitMilli'])} | "
            f"{format_mib(resources['memoryRequestMiB'])} | "
            f"{format_mib(resources['memoryLimitMiB'])} | "
            f"{format_mib(resources['ephemeralRequestMiB'])} | "
            f"{format_mib(resources['ephemeralLimitMiB'])} |"
        )

    lines.extend(
        [
            "",
            "## Totals",
            "",
            "| Metric | Value |",
            "|---|---:|",
            f"| Total request CPU | {format_mcpu(totals['cpuRequestMilli'])} |",
            f"| Total limit CPU | {format_mcpu(totals['cpuLimitMilli'])} |",
            f"| Total request memory | {format_mib(totals['memoryRequestMiB'])} |",
            f"| Total limit memory | {format_mib(totals['memoryLimitMiB'])} |",
            f"| Total request ephemeral | {format_mib(totals['ephemeralRequestMiB'])} |",
            f"| Total limit ephemeral | {format_mib(totals['ephemeralLimitMiB'])} |",
            f"| Residual RAM headroom above summed requests | {format_mib(totals['residualHeadroomAboveRequestsMiB'])} |",
            f"| Limit overcommit above safe resident budget | {format_mib(totals['overcommitAgainstSafeResidentBudgetMiB'])} |",
            "",
            "## Interpretation",
            "",
            f"- The current staged core manifests request `{format_mib(totals['memoryRequestMiB'])}` of RAM across the four runtime pods.",
            f"- With a pre-deploy MemAvailable floor of `{format_mib(node['preDeployMemAvailableFloorMiB'])}`, only `{format_mib(node['safeResidentBudgetMiB'])}` of node RAM is treated as safe for application working set during rollout.",
            f"- That leaves `{format_mib(totals['residualHeadroomAboveRequestsMiB'])}` of physical RAM above the summed pod requests before swap becomes part of the survival story.",
            f"- The summed pod memory limits still reach `{format_mib(totals['memoryLimitMiB'])}`, which exceeds the safe resident budget by `{format_mib(totals['overcommitAgainstSafeResidentBudgetMiB'])}`. Treat that as a warning that simultaneous peak usage is not safe on a 1 GB node.",
            f"- Until live OCI evidence replaces them, the deploy gate thresholds remain provisional defaults: MemAvailable `{format_mib(node['preDeployMemAvailableFloorMiB'])}`, SwapFree `{format_mib(node['preDeploySwapFreeFloorMiB'])}`.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> None:
    args = parse_args()
    manifest_dir = Path(args.manifest_dir)
    apply_order_path = manifest_dir / APPLY_ORDER_FILE
    if not apply_order_path.is_file():
        raise SystemExit(f"Apply order file not found: {apply_order_path}")

    manifest_names = [
        line.strip()
        for line in apply_order_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    services: list[ServiceBudget] = []
    for order, manifest_name in enumerate(manifest_names, start=1):
        manifest_path = manifest_dir / manifest_name
        if not manifest_path.is_file():
            raise SystemExit(f"Expected staged manifest is missing: {manifest_path}")
        service_name, resources = extract_deployment_budget(manifest_path)
        services.append(
            ServiceBudget(
                order=order,
                manifest_file=manifest_name,
                service=service_name,
                resources=resources,
            )
        )

    report = build_report(services, args)

    output_markdown = Path(args.output_markdown) if args.output_markdown else manifest_dir / MARKDOWN_REPORT_FILE
    output_json = Path(args.output_json) if args.output_json else manifest_dir / JSON_REPORT_FILE
    output_markdown.write_text(render_markdown(report), encoding="utf-8")
    output_json.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Wrote budget markdown: {output_markdown}")
    print(f"Wrote budget json: {output_json}")


if __name__ == "__main__":
    main()
