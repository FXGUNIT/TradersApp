#!/usr/bin/env python3
"""Send a lightweight Slack/Discord alert without failing the caller."""

from __future__ import annotations

import argparse
import json
import os
import sys
from urllib.error import URLError
from urllib.request import Request, urlopen


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send Slack/Discord webhook alerts.")
    parser.add_argument("--title", required=True, help="Alert title")
    parser.add_argument("--body", required=True, help="Alert body text")
    parser.add_argument(
        "--status",
        default="info",
        choices=("info", "success", "warning", "error"),
        help="Alert severity",
    )
    parser.add_argument("--run-url", default="", help="Optional workflow run URL")
    parser.add_argument("--slack-webhook-url", default=os.environ.get("SLACK_WEBHOOK_URL", ""))
    parser.add_argument("--discord-webhook-url", default=os.environ.get("DISCORD_WEBHOOK_URL", ""))
    return parser.parse_args()


def post_json(url: str, payload: dict) -> None:
    if not url:
        return
    data = json.dumps(payload).encode("utf-8")
    request = Request(url, data=data, headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=15) as response:
        response.read()


def status_emoji(status: str) -> str:
    return {
        "success": ":white_check_mark:",
        "warning": ":warning:",
        "error": ":rotating_light:",
        "info": ":information_source:",
    }[status]


def main() -> int:
    args = parse_args()
    if not args.slack_webhook_url and not args.discord_webhook_url:
        print("No Slack or Discord webhook configured; skipping alert send.")
        return 0

    prefix = status_emoji(args.status)
    run_suffix = f"\nRun: {args.run_url}" if args.run_url else ""
    slack_payload = {
        "text": f"{prefix} {args.title}",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{prefix} *{args.title}*\n{args.body}{run_suffix}",
                },
            }
        ],
    }
    discord_payload = {
        "content": f"{prefix} **{args.title}**\n{args.body}{run_suffix}",
    }

    errors: list[str] = []
    for label, url, payload in (
        ("Slack", args.slack_webhook_url, slack_payload),
        ("Discord", args.discord_webhook_url, discord_payload),
    ):
        if not url:
            continue
        try:
            post_json(url, payload)
            print(f"{label} alert sent.")
        except URLError as exc:
            errors.append(f"{label} webhook failed: {exc.reason}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{label} webhook failed: {exc}")

    if errors:
        for error in errors:
            print(error, file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
