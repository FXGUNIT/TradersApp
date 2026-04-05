#!/usr/bin/env python3
"""
Parse Prometheus /api/v1/alerts response and extract firing alert names.
Used by .github/workflows/monitor.yml to surface active ML-specific alerts.
"""

import json
import sys

def main():
    input_file = sys.argv[1] if len(sys.argv) > 1 else "/tmp/prometheus_alerts.json"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "/tmp/firing_alerts.txt"

    try:
        with open(input_file) as f:
            data = json.load(f)

        if data.get("status") == "success":
            firing = [
                a["labels"]["alertname"]
                for a in data["data"]["alerts"]
                if a["state"] == "firing"
            ]
            result = "\n".join(firing) if firing else "NONE"
        else:
            result = "NONE"
    except Exception:
        result = "NONE"

    print(result)
    with open(output_file, "w") as f:
        f.write(result)

if __name__ == "__main__":
    main()
