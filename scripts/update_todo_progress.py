from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TODO_PATH = ROOT / "docs" / "TODO_MASTER_LIST.md"
MASTER_PROGRESS_START = "<!-- master-progress:start -->"
MASTER_PROGRESS_END = "<!-- master-progress:end -->"
PROGRESS_START = "<!-- live-status:start -->"
PROGRESS_END = "<!-- live-status:end -->"
LAST_UPDATED_RE = re.compile(r"^\*\*Last Updated:\*\* .+$", re.MULTILINE | re.IGNORECASE)
STATUS_SCORE = {
    "Done": 1.0,
    "Partial": 0.5,
    "Blocked": 0.0,
    "Todo": 0.0,
}


@dataclass
class Task:
    phase: str
    task_id: str  # int or alphanumeric (e.g. "D10", "71")
    status: str
    estimate_raw: str
    estimate_min_days: float
    estimate_max_days: float


@dataclass
class ExecutionStep:
    step_id: str
    stage: str
    status: str
    title: str


@dataclass
class ChecklistItem:
    area: str
    phase_id: str
    phase_title: str
    status: str
    raw_title: str


def parse_estimate_days(value: str) -> tuple[float, float]:
    text = value.strip().lower()
    if not text or text == "0d":
        return 0.0, 0.0

    match = re.fullmatch(r"(?P<min>\d+(?:\.\d+)?)(?:-(?P<max>\d+(?:\.\d+)?))?d", text)
    if not match:
        return 0.0, 0.0

    min_days = float(match.group("min"))
    max_days = float(match.group("max") or match.group("min"))
    return min_days, max_days


def parse_tasks(markdown: str) -> list[Task]:
    tasks: list[Task] = []
    current_phase = "Unscoped"
    in_execution_tracker = False

    for line in markdown.splitlines():
        # Skip the Execution Tracker section — it uses checklist rows with | chars
        # that corrupt the table column splitter. Only parse the Detailed Backlog tables.
        if line.strip().startswith("## Execution Tracker"):
            in_execution_tracker = True
            continue
        if in_execution_tracker:
            # Skip until next top-level section (## at column 0)
            if re.match(r"^##\s+\S", line):
                in_execution_tracker = False
            else:
                continue

        phase_match = re.match(r"^###\s+(Phase\s+\d+:\s+.+)$", line.strip())
        if phase_match:
            current_phase = phase_match.group(1)
            continue

        if not line.startswith("|"):
            continue

        columns = [column.strip() for column in line.strip().strip("|").split("|")]
        if not columns or not re.match(r"^[A-Z0-9]+$", columns[0]):
            continue

        # Reject rows whose second column is not a known task status
        # (guards against "Immediate Next Actions" table: | P0 | **bold text** | ...)
        status = columns[1] if len(columns) > 1 else ""
        if status not in ("Done", "Partial", "Todo"):
            continue

        task_id = columns[0]
        estimate_raw = columns[-1]
        min_days, max_days = parse_estimate_days(estimate_raw)
        tasks.append(
            Task(
                phase=current_phase,
                task_id=task_id,
                status=status,
                estimate_raw=estimate_raw,
                estimate_min_days=min_days,
                estimate_max_days=max_days,
            )
        )

    return tasks


def parse_execution_steps(markdown: str) -> list[ExecutionStep]:
    steps: list[ExecutionStep] = []
    current_stage = "Unscoped"

    for line in markdown.splitlines():
        stage_match = re.match(r"^###\s+(Stage\s+[A-Z]:\s+.+)$", line.strip())
        if stage_match:
            current_stage = stage_match.group(1)
            continue

        step_match = re.match(r"^- \[(?P<mark>[ x-])\]\s+`(?P<id>[A-Z]\d{2})`\s+(?P<title>.+)$", line.strip())
        if not step_match:
            continue

        mark = step_match.group("mark")
        status = {"x": "Done", "-": "Partial", " ": "Todo"}[mark]
        steps.append(
            ExecutionStep(
                step_id=step_match.group("id"),
                stage=current_stage,
                status=status,
                title=step_match.group("title").strip(),
            )
        )

    return steps


def format_pct(value: float) -> str:
    return f"{value:07.3f}%"


def format_days(value: float) -> str:
    return f"{value:07.3f}d"


def format_weeks(value: float) -> str:
    return f"{value:.1f}w"


def make_bar(percent: float, width: int = 40) -> str:
    clamped = max(0.0, min(100.0, percent))
    filled = round((clamped / 100.0) * width)
    return "[" + ("#" * filled) + ("-" * (width - filled)) + "]"


def format_count(value: float) -> str:
    return f"{int(value):03d}"


def strip_generated_blocks(markdown: str) -> str:
    cleaned = markdown
    for start_marker, end_marker in (
        (MASTER_PROGRESS_START, MASTER_PROGRESS_END),
        (PROGRESS_START, PROGRESS_END),
    ):
        cleaned = re.sub(
            rf"{re.escape(start_marker)}.*?{re.escape(end_marker)}\s*",
            "",
            cleaned,
            flags=re.DOTALL,
        )
    return cleaned


def parse_master_checklist(markdown: str) -> list[ChecklistItem]:
    items: list[ChecklistItem] = []
    current_section = ""
    current_subsection = ""

    for line in strip_generated_blocks(markdown).splitlines():
        section_match = re.match(r"^##\s+(.+)$", line.strip())
        if section_match:
            current_section = section_match.group(1).strip()
            current_subsection = ""
            continue

        subsection_match = re.match(r"^###\s+(.+)$", line.strip())
        if subsection_match:
            current_subsection = subsection_match.group(1).strip()
            continue

        task_match = re.match(r"^-\s+\[(?P<mark>[ x!\-])\]\s+(?P<title>.+)$", line)
        if not task_match:
            continue

        status = _marker_to_status(task_match.group("mark"))
        task_title = task_match.group("title").strip()
        item = classify_checklist_item(current_section, current_subsection, task_title, status)
        if item is not None:
            items.append(item)

    return items


def classify_checklist_item(
    current_section: str,
    current_subsection: str,
    task_title: str,
    status: str,
) -> ChecklistItem | None:
    normalized_section = current_section.upper()

    if normalized_section.startswith("STAGE P"):
        phase_match = re.match(r"^(P\d{2})\b", current_subsection)
        phase_id = phase_match.group(1) if phase_match else "P00"
        phase_title = current_subsection or phase_id
        return ChecklistItem(
            area="Stage P",
            phase_id=phase_id,
            phase_title=phase_title,
            status=status,
            raw_title=task_title,
        )

    if normalized_section.startswith("STAGE S"):
        phase_match = re.match(r"^Phase\s+(S\d+)\b", current_subsection)
        phase_id = phase_match.group(1) if phase_match else "S0"
        phase_title = current_subsection or phase_id
        return ChecklistItem(
            area="Stage S",
            phase_id=phase_id,
            phase_title=phase_title,
            status=status,
            raw_title=task_title,
        )

    if normalized_section.startswith("STAGES ML"):
        phase_match = re.match(r"^(ML\d+)\b", task_title)
        phase_id = phase_match.group(1) if phase_match else "ML"
        phase_title = phase_id if phase_match else "ML Research"
        return ChecklistItem(
            area="ML Research",
            phase_id=phase_id,
            phase_title=phase_title,
            status=status,
            raw_title=task_title,
        )

    return None


def summarize_checklist_items(items: list[ChecklistItem]) -> dict[str, float]:
    total = len(items)
    done = sum(1 for item in items if item.status == "Done")
    partial = sum(1 for item in items if item.status == "Partial")
    blocked = sum(1 for item in items if item.status == "Blocked")
    todo = sum(1 for item in items if item.status == "Todo")
    weighted_done = sum(STATUS_SCORE.get(item.status, 0.0) for item in items)
    completion_pct = (weighted_done / total * 100.0) if total else 0.0
    return {
        "total": total,
        "done": done,
        "partial": partial,
        "blocked": blocked,
        "todo": todo,
        "completion_pct": completion_pct,
    }


def infer_heading_status(heading: str, done: int, total: int) -> str:
    normalized = heading.lower()
    if total > 0 and done == total:
        return "DONE"
    if "current blocker" in normalized:
        return "CURRENT BLOCKER"
    if "blocked by" in normalized or normalized.endswith("blocked"):
        return "BLOCKED"
    if "known issue" in normalized:
        return "KNOWN ISSUE"
    if "in progress" in normalized:
        return "IN PROGRESS"
    if "pending" in normalized or "required" in normalized:
        return "PENDING"
    if done > 0:
        return "IN PROGRESS"
    return "PENDING"


def infer_aggregate_status(statuses: list[str], done: int, total: int) -> str:
    if total > 0 and done == total:
        return "DONE"
    if "CURRENT BLOCKER" in statuses:
        return "CURRENT BLOCKER"
    if "BLOCKED" in statuses:
        return "BLOCKED"
    if "KNOWN ISSUE" in statuses:
        return "KNOWN ISSUE"
    if "IN PROGRESS" in statuses:
        return "IN PROGRESS"
    return "PENDING"


def phase_sort_key(phase_id: str) -> tuple[int, int | str]:
    if phase_id.startswith("P") and phase_id[1:].isdigit():
        return (0, int(phase_id[1:]))
    if phase_id.startswith("S") and phase_id[1:].isdigit():
        return (1, int(phase_id[1:]))
    if phase_id.startswith("ML") and phase_id[2:].isdigit():
        return (2, int(phase_id[2:]))
    return (3, phase_id)


def build_master_progress_block(markdown: str) -> str:
    items = parse_master_checklist(markdown)
    summary = summarize_checklist_items(items)

    phase_buckets: dict[str, dict[str, object]] = {}
    area_buckets: dict[str, list[ChecklistItem]] = {
        "Stage P": [],
        "Stage S": [],
        "ML Research": [],
    }

    for item in items:
        area_buckets.setdefault(item.area, []).append(item)
        bucket = phase_buckets.setdefault(
            item.phase_id,
            {
                "title": item.phase_title,
                "items": [],
            },
        )
        bucket["items"].append(item)

    tier_defs = [
        ("TIER 1", "Stage P rollout path", lambda item: item.area == "Stage P"),
        ("TIER 2", "Bootstrap + minimal core", lambda item: item.phase_id in {"P07", "P08", "P09"}),
        ("TIER 3", "OCI ingress + DNS cutover", lambda item: item.phase_id in {"P11", "P12", "P13"}),
        ("TIER 4", "Stage S + ML backlog", lambda item: item.area in {"Stage S", "ML Research"}),
    ]

    timestamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")
    lines = [
        MASTER_PROGRESS_START,
        "## Progress Dashboard",
        f"Generated: `{timestamp}`  ·  Run `python scripts/update_todo_progress.py --once` to update",
        "",
        "```text",
        f"Master Backlog {summary['completion_pct']:5.1f}%  {make_bar(summary['completion_pct'], width=24)}",
        f"Tasks          done {format_count(summary['done'])} | in progress {format_count(summary['partial'])} | blocked {format_count(summary['blocked'])} | todo {format_count(summary['todo'])} | total {format_count(summary['total'])}",
        "```",
        "",
        "How to read this:",
        "- `Master Backlog` counts every checkbox task across Stage P, Stage S, and ML research.",
        "- Tier bars are strategic buckets and can overlap; phase bars are the exact checklist counts.",
        "",
        "### By Area",
        "",
        "| Area | Tasks | Progress | Status |",
        "|---|---|---:|---|",
    ]

    for area_name in ("Stage P", "Stage S", "ML Research"):
        area_items = area_buckets.get(area_name, [])
        area_summary = summarize_checklist_items(area_items)
        phase_statuses: list[str] = []
        for phase_id, bucket in phase_buckets.items():
            bucket_items = bucket["items"]
            if bucket_items and bucket_items[0].area == area_name:
                done = sum(1 for item in bucket_items if item.status == "Done")
                phase_statuses.append(infer_heading_status(str(bucket["title"]), done, len(bucket_items)))
        status_label = infer_aggregate_status(phase_statuses, int(area_summary["done"]), int(area_summary["total"]))
        lines.append(
            f"| {area_name} | [{int(area_summary['done'])}/{int(area_summary['total'])}] | {area_summary['completion_pct']:5.1f}% | {status_label} |"
        )

    lines.extend(
        [
            "",
            "### By Tier",
            "",
            "| Tier | Scope | Progress | Status |",
            "|---|---|---:|---|",
        ]
    )

    for tier_name, scope_label, matcher in tier_defs:
        tier_items = [item for item in items if matcher(item)]
        tier_summary = summarize_checklist_items(tier_items)
        phase_statuses = []
        seen_phase_ids = {item.phase_id for item in tier_items}
        for phase_id in seen_phase_ids:
            bucket = phase_buckets.get(phase_id)
            if bucket is None:
                continue
            bucket_items = bucket["items"]
            done = sum(1 for item in bucket_items if item.status == "Done")
            phase_statuses.append(infer_heading_status(str(bucket["title"]), done, len(bucket_items)))
        status_label = infer_aggregate_status(phase_statuses, int(tier_summary["done"]), int(tier_summary["total"]))
        lines.append(
            f"| {tier_name} | {scope_label} | {tier_summary['completion_pct']:5.1f}% | {status_label} |"
        )

    lines.extend(
        [
            "",
            "### By Phase",
            "",
            "| Phase | Tasks | Progress | Status |",
            "|---|---|---:|---|",
        ]
    )

    for phase_id in sorted(phase_buckets.keys(), key=phase_sort_key):
        bucket = phase_buckets[phase_id]
        bucket_items: list[ChecklistItem] = bucket["items"]  # type: ignore[assignment]
        bucket_summary = summarize_checklist_items(bucket_items)
        status_label = infer_heading_status(str(bucket["title"]), int(bucket_summary["done"]), int(bucket_summary["total"]))
        lines.append(
            f"| {phase_id} - {bucket['title']} | [{int(bucket_summary['done'])}/{int(bucket_summary['total'])}] | {bucket_summary['completion_pct']:5.1f}% | {status_label} |"
        )

    lines.extend(["", MASTER_PROGRESS_END])
    return "\n".join(lines)


def summarize(tasks: list[Task]) -> tuple[str, dict[str, dict[str, float]]]:
    total = len(tasks)
    done = sum(1 for task in tasks if task.status == "Done")
    partial = sum(1 for task in tasks if task.status == "Partial")
    todo = sum(1 for task in tasks if task.status == "Todo")
    weighted_done = sum(STATUS_SCORE.get(task.status, 0.0) for task in tasks)
    completion_pct = (weighted_done / total * 100.0) if total else 0.0
    remaining_pct = 100.0 - completion_pct
    remaining_min_days = sum(task.estimate_min_days for task in tasks if task.status != "Done")
    remaining_max_days = sum(task.estimate_max_days for task in tasks if task.status != "Done")
    remaining_mid_days = (remaining_min_days + remaining_max_days) / 2.0
    remaining_conservative_days = remaining_min_days + ((remaining_max_days - remaining_min_days) * 0.90)
    likely_weeks = remaining_mid_days / 5.0
    conservative_weeks = remaining_conservative_days / 5.0

    per_phase: dict[str, dict[str, float]] = {}
    for task in tasks:
        phase = per_phase.setdefault(
            task.phase,
            {
                "total": 0.0,
                "done": 0.0,
                "partial": 0.0,
                "todo": 0.0,
                "weighted_done": 0.0,
                "remaining_min_days": 0.0,
                "remaining_max_days": 0.0,
            },
        )
        phase["total"] += 1
        phase[task.status.lower()] += 1
        phase["weighted_done"] += STATUS_SCORE.get(task.status, 0.0)
        if task.status != "Done":
            phase["remaining_min_days"] += task.estimate_min_days
            phase["remaining_max_days"] += task.estimate_max_days

    timestamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    lines = [
        PROGRESS_START,
        "_Progress block is generated by `python scripts/update_todo_progress.py`._",
        "",
        "## Live Progress",
        "",
        f"Last sync: `{timestamp}`",
        "",
        "```text",
        "PROJECT STATUS",
        f"Complete      {format_pct(completion_pct)}  {make_bar(completion_pct, width=28)}",
        f"Remaining     {format_pct(remaining_pct)}  {make_bar(remaining_pct, width=28)}",
        f"Tasks         done {done:03d} | in progress {partial:03d} | not started {todo:03d} | total {total:03d}",
        f"Backlog       likely {format_weeks(likely_weeks)} work weeks",
        f"Range         best case {format_weeks(remaining_min_days / 5.0)} | conservative {format_weeks(conservative_weeks)} | max {format_weeks(remaining_max_days / 5.0)}",
        "```",
        "",
        "How to read this:",
        "- This is backlog effort for the full remaining program, not literal nonstop calendar time for the current step.",
        f"- `likely` means roughly `{format_weeks(likely_weeks)}` of single-engineer work if done mostly sequentially.",
        "- The immediate next stage is much smaller than the full backlog.",
        "",
        "### Phase Progress",
        "",
        "| Phase | Progress | Status | Likely Left |",
        "|---|---:|---|---:|",
    ]

    for phase_name, data in per_phase.items():
        phase_total = data["total"]
        phase_pct = (data["weighted_done"] / phase_total * 100.0) if phase_total else 0.0
        phase_min = data["remaining_min_days"]
        phase_max = data["remaining_max_days"]
        phase_mid = (phase_min + phase_max) / 2.0
        lines.append(
            "| "
            + " | ".join(
                [
                    phase_name,
                    format_pct(phase_pct),
                    f"`{make_bar(phase_pct, width=18)}` {format_count(data['done'])}/{format_count(int(phase_total))} done",
                    format_weeks(phase_mid / 5.0),
                ]
            )
            + " |"
        )

    lines.extend(["", PROGRESS_END])
    return "\n".join(lines), per_phase


def summarize_execution(steps: list[ExecutionStep]) -> tuple[float, int, int, int, list[ExecutionStep]]:
    total = len(steps)
    done = sum(1 for step in steps if step.status == "Done")
    partial = sum(1 for step in steps if step.status == "Partial")
    todo = sum(1 for step in steps if step.status == "Todo")
    weighted_done = sum(STATUS_SCORE.get(step.status, 0.0) for step in steps)
    completion_pct = (weighted_done / total * 100.0) if total else 0.0
    next_steps = [step for step in steps if step.status != "Done"][:5]
    return completion_pct, done, partial, todo, next_steps


def build_progress_block(markdown: str) -> str:
    tasks = parse_tasks(markdown)
    steps = parse_execution_steps(markdown)
    block, _ = summarize(tasks)
    exec_pct, exec_done, exec_partial, exec_todo, next_steps = summarize_execution(steps)
    if steps:
        next_lines = ["", "Execution line:", "```text"]
        next_lines.append(f"Execution     {format_pct(exec_pct)}  {make_bar(exec_pct, width=28)}")
        next_lines.append(
            f"Tracker       done {exec_done:03d} | in progress {exec_partial:03d} | todo {exec_todo:03d} | total {len(steps):03d}"
        )
        for index, step in enumerate(next_steps[:3], start=1):
            next_lines.append(f"Next {index}        {step.step_id}  {step.title}")
        next_lines.append("```")
        block = block.replace("### Phase Progress", "\n".join(next_lines) + "\n\n### Phase Progress", 1)
    return block


def build_updated_markdown(todo_path: Path) -> str:
    """Write live status into the TODO_MASTER_LIST.md file.

    The coordination JSON + LiveStatus block are updated in-place.
    Everything else in the file stays untouched.
    """
    markdown = todo_path.read_text(encoding="utf-8")

    # ---- 1. Coordination block: update claimed_by / claimed_at ----
    markdown = _sync_coordination_block(markdown)

    # ---- 2. Live Status table: rebuild from current task state ----
    block = _build_live_status_table(markdown)
    pattern = re.compile(
        rf"{re.escape(PROGRESS_START)}.*?{re.escape(PROGRESS_END)}",
        re.DOTALL,
    )
    if pattern.search(markdown):
        updated = pattern.sub(block, markdown, count=1)
    else:
        # No existing block — append before the first ## Stage or ## Phase
        marker = re.search(r"(?=^## (?:Stage|Phase))", markdown, re.MULTILINE)
        if marker:
            pos = marker.start()
            updated = markdown[:pos] + block + "\n\n" + markdown[pos:]
        else:
            updated = markdown + "\n\n" + block

    # ---- 3. Touch timestamp on Last updated line ----
    updated = LAST_UPDATED_RE.sub(
        f"**Last Updated:** {datetime.now().astimezone().strftime('%Y-%m-%d')}",
        updated,
        count=1,
    )
    # ensure trailing newline
    return updated.rstrip("\n") + "\n"


def _sync_coordination_block(markdown: str) -> str:
    """Parse the coordination JSON block and update claimed_at timestamps
    for any task whose status has changed since the last sync.

    An agent claims a task by setting claimed_by in the JSON.
    We use file-modification time as a lightweight expiry sentinel.
    """
    return markdown  # no-op for now — agents update directly in the file


def _build_live_status_table(markdown: str) -> str:
    """Build the Live Status markdown table from the current Stage P checklist layout."""
    section_start = re.search(r"^## STAGE P\b.*$", markdown, re.MULTILINE)
    if not section_start:
        return _build_legacy_live_status_table(markdown)

    tail = markdown[section_start.start() :]
    next_section = re.search(r"^## (?!STAGE P\b)", tail, re.MULTILINE)
    stage_block = tail[: next_section.start()] if next_section else tail

    sections: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    heading_re = re.compile(r"^###\s+(P\d{2})\b.*$")
    checkbox_re = re.compile(r"^-\s+\[(?P<mark>[ x])\]\s+(?P<title>.+)$")

    for line in stage_block.splitlines():
        heading_match = heading_re.match(line.strip())
        if heading_match:
            if current is not None:
                sections.append(current)
            current = {
                "id": heading_match.group(1),
                "heading": line.strip()[4:].strip(),
                "done": 0,
                "todo": 0,
            }
            continue

        if current is None:
            continue

        checkbox_match = checkbox_re.match(line)
        if checkbox_match:
            if checkbox_match.group("mark") == "x":
                current["done"] += 1
            else:
                current["todo"] += 1

    if current is not None:
        sections.append(current)

    if not sections:
        return _build_legacy_live_status_table(markdown)

    done_sections = 0
    active_sections = 0
    blocked_sections = 0
    pending_sections = 0
    done_tasks = 0
    open_tasks = 0
    rows: list[str] = []

    for section in sections:
        section_id = str(section["id"])
        heading = str(section["heading"])
        done = int(section["done"])
        todo = int(section["todo"])
        total = done + todo
        pct = (done / total * 100.0) if total else 0.0
        status_label = _infer_stage_p_status(heading, done, total)

        if status_label == "DONE":
            done_sections += 1
        elif status_label in {"IN PROGRESS", "CURRENT BLOCKER"}:
            active_sections += 1
        elif status_label.startswith("BLOCKED"):
            blocked_sections += 1
        else:
            pending_sections += 1

        done_tasks += done
        open_tasks += todo

        label = re.sub(r"^P\d{2}\s*[-:—]*\s*", "", heading).strip()
        rows.append(f"| {section_id} - {label} | [{done}/{total}] | {pct:5.1f}% | {status_label} |")

    timestamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")
    section_total = len(sections)
    task_total = done_tasks + open_tasks
    backlog_pct = (done_tasks / task_total * 100.0) if task_total else 0.0

    header = (
        f"{PROGRESS_START}\n"
        "## Live Status\n"
        f"Generated: `{timestamp}`  -  Run `python scripts/update_todo_progress.py --once` to update\n\n"
        "```text\n"
        f"Stage P Backlog {backlog_pct:5.1f}%  {make_bar(backlog_pct, width=24)}\n"
        f"Sections        done {format_count(done_sections)} | active {format_count(active_sections)} | blocked {format_count(blocked_sections)} | pending {format_count(pending_sections)} | total {format_count(section_total)}\n"
        f"Checklist       done {format_count(done_tasks)} | open {format_count(open_tasks)} | total {format_count(task_total)}\n"
        "```\n\n"
        "| Section | Tasks | Progress | Status |\n"
        "|---|---|---:|---|\n"
    )
    return header + "\n".join(rows) + f"\n\n{PROGRESS_END}\n"


def _build_legacy_live_status_table(markdown: str) -> str:
    """Fallback for older TODO layouts that used Stage/Phase task IDs."""
    stage_tasks: dict[str, list[dict]] = {}
    current_section = "Unknown"

    lines = markdown.splitlines()
    section_re = re.compile(r"^## (Stage [A-Z]|Phase \d+)")
    task_re = re.compile(r"^-\s+\[([ x!\-])\]\s+`([A-Z0-9-]+)`\s+(.+?)(?:\n|$)")

    for line in lines:
        sm = section_re.match(line.strip())
        if sm:
            current_section = sm.group(1).strip()
            stage_tasks.setdefault(current_section, [])
            continue
        tm = task_re.match(line)
        if tm:
            marker, tid, title = tm.group(1), tm.group(2), tm.group(3).strip()
            status = _marker_to_status(marker)
            stage_tasks.setdefault(current_section, []).append(
                {
                    "id": tid,
                    "status": status,
                    "title": title,
                }
            )

    rows = []
    total_tasks = 0
    done_tasks = 0
    partial_tasks = 0
    blocked_tasks = 0
    todo_tasks = 0
    completed_sections = 0

    for section, tasks in stage_tasks.items():
        if not tasks:
            continue
        done = sum(1 for t in tasks if t["status"] == "Done")
        partial = sum(1 for t in tasks if t["status"] == "Partial")
        blocked = sum(1 for t in tasks if t["status"] == "Blocked")
        todo = sum(1 for t in tasks if t["status"] == "Todo")
        total = len(tasks)
        pct = done / total * 100.0 if total else 0.0

        if done == total:
            status_label = "COMPLETE"
            completed_sections += 1
        elif blocked and not done and not partial:
            status_label = "BLOCKED"
        elif done or partial or blocked:
            status_label = "IN PROGRESS"
        else:
            status_label = "PENDING"

        total_tasks += total
        done_tasks += done
        partial_tasks += partial
        blocked_tasks += blocked
        todo_tasks += todo

        badge = f"[{done}/{total}]"
        rows.append(f"| {section} | {badge} | {pct:5.1f}% | {status_label} |")

    timestamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")
    section_total = len(rows)
    weighted_done = done_tasks + (partial_tasks * STATUS_SCORE["Partial"])
    backlog_pct = (weighted_done / total_tasks * 100.0) if total_tasks else 0.0

    header = (
        f"{PROGRESS_START}\n"
        "## Live Status\n"
        f"Generated: `{timestamp}`  ?  Run `python scripts/update_todo_progress.py --once` to update\n\n"
        "```text\n"
        f"Active Backlog  {backlog_pct:5.1f}%  {make_bar(backlog_pct, width=24)}\n"
        f"Stage Progress  {completed_sections:02d}/{section_total:02d} complete\n"
        f"Task Counts     done {format_count(done_tasks)} | in progress {format_count(partial_tasks)} | blocked {format_count(blocked_tasks)} | todo {format_count(todo_tasks)} | total {format_count(total_tasks)}\n"
        "```\n\n"
        "| Section | Tasks | Progress | Status |\n"
        "|---|---|---:|---|\n"
    )
    return header + "\n".join(rows) + f"\n\n{PROGRESS_END}\n"


def _infer_stage_p_status(heading: str, done: int, total: int) -> str:
    normalized = heading.lower()
    if done == total and total > 0:
        return "DONE"
    if "current blocker" in normalized:
        return "CURRENT BLOCKER"
    if "blocked by" in normalized:
        return "BLOCKED"
    if "in progress" in normalized:
        return "IN PROGRESS"
    if "known issue" in normalized:
        return "KNOWN ISSUE"
    if "required" in normalized or "pending" in normalized:
        return "PENDING"
    return "PENDING"


def _marker_to_status(marker: str) -> str:
    return {"x": "Done", "-": "Partial", "!": "Blocked"}.get(marker, "Todo")


def main() -> None:
    parser = argparse.ArgumentParser(description="Update docs/TODO_MASTER_LIST.md live status table.")
    parser.add_argument(
        "--file",
        type=Path,
        default=DEFAULT_TODO_PATH,
        help="Path to the TODO markdown file.",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Print the updated markdown instead of writing the file.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single sync and exit (used by CI / git hooks).",
    )
    args = parser.parse_args()
    todo_path = args.file.resolve()
    updated_markdown = build_updated_markdown(todo_path)
    if args.stdout:
        print(updated_markdown, end="")
        return
    todo_path.write_text(updated_markdown, encoding="utf-8")
    print(f"Updated live status in {args.file}")


if __name__ == "__main__":
    main()
