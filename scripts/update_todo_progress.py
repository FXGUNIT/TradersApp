from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TODO_PATH = ROOT / "docs" / "TODO_MASTER_LIST.md"
PROGRESS_START = "<!-- live-status:start -->"
PROGRESS_END = "<!-- live-status:end -->"
LAST_UPDATED_RE = re.compile(r"^\*\*Last updated:\*\* .+$", re.MULTILINE)
STATUS_SCORE = {
    "Done": 1.0,
    "Partial": 0.5,
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
        f"**Last updated:** {datetime.now().astimezone().strftime('%Y-%m-%d')}",
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
    """Build the Live Status markdown table by scanning Stage/Phase task lines."""
    stage_tasks: dict[str, list[dict]] = {}  # stage_name -> [{id, status, title}]
    current_section = "Unknown"

    lines = markdown.splitlines()
    section_re = re.compile(r"^## (Stage [A-Z]|Phase \d+)")
    task_re = re.compile(r"^-\s+\[(\S)\]\s+`([A-Z0-9-]+)`\s+(.+?)(?:\n|$)")

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
            stage_tasks.setdefault(current_section, []).append({
                "id": tid,
                "status": status,
                "title": title,
            })

    # Build table
    rows = []
    for section, tasks in stage_tasks.items():
        if not tasks:
            continue
        done = sum(1 for t in tasks if t["status"] == "Done")
        ip = sum(1 for t in tasks if t["status"] == "Partial")
        blk = sum(1 for t in tasks if t["status"] == "Blocked")
        total = len(tasks)
        pct = done / total * 100.0 if total else 0.0

        status_icon = "✅ COMPLETE" if done == total else ("🔄 IN PROGRESS" if ip else "⏸ PENDING")
        badge = f"[{done}/{total}]"
        rows.append(f"| {section} | {badge} | {pct:5.1f}% | {status_icon} |")

    timestamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")

    header = (
        f"{PROGRESS_START}\n"
        "## Live Status\n"
        f"Generated: `{timestamp}`  ·  Run `python scripts/update_todo_progress.py --once` to update\n\n"
        "| Section | Tasks | Progress | Status |\n"
        "|---|---|---:|---|\n"
    )
    return header + "\n".join(rows) + f"\n\n{PROGRESS_END}\n"


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
