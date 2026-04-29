// bff/services/telegramAgentCommands.mjs
// Whitelisted commands the Telegram agent can execute.

import { getWatchtowerStatus, runWatchtowerScan } from "./watchtowerService.mjs";

function istNow() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
}

export async function executeCommand(cmd, args) {
  switch (cmd.toLowerCase()) {
    case "status": {
      const s = getWatchtowerStatus();
      const daemon = s.daemon || {};
      const intervalMin = Math.round((daemon.nextIntervalMs || 900000) / 60000);
      return [
        `*BFF Watchtower Status*`,
        `OK: ${s.ok ? "✅" : "❌"}`,
        `Daemon: ${daemon.active ? "🟢 active" : "⚪ inactive"}`,
        `IST: ${daemon.currentIstHour}:00 (${daemon.isDayHours ? "☀️ day" : "🌙 night"})`,
        `Scan every: ${intervalMin} min`,
        `Faults open: ${s.faults?.length || 0}`,
        `Resolved (session): ${s.resolvedCount || 0}`,
        `As of: ${istNow()} IST`,
      ].join("\n");
    }

    case "scan": {
      const result = await runWatchtowerScan();
      return [
        `*Watchtower Scan Triggered*`,
        `Status: ${result.status || "unknown"}`,
        `Faults found: ${result.faults?.length || 0}`,
        `Scanned: ${istNow()} IST`,
      ].join("\n");
    }

    case "logs": {
      const lines = global._bffLogBuffer || [];
      const count = Math.min(parseInt(args) || 50, 200);
      const tail = lines.slice(-count);
      if (tail.length === 0) return "_No logs available._";
      return "```\n" + tail.join("\n") + "\n```";
    }

    case "reboot": {
      return [
        "_Reboot must be triggered via GitHub Actions workflow_",
        "`workflow_dispatch` → Reboot Contabo VPS",
        "Do it from the GitHub Actions tab.",
      ].join("\n");
    }

    case "help": {
      return [
        `*Telegram Agent Commands*`,
        `/status — Watchtower health + IST time`,
        `/scan   — Trigger Watchtower scan now`,
        `/logs   — Last 50 BFF log lines`,
        `/ask <question> — Ask the AI anything`,
        `/help   — This list`,
      ].join("\n");
    }

    default: {
      return [
        `Unknown command: /${cmd}`,
        "Try /help for available commands.",
      ].join("\n");
    }
  }
}

export default { executeCommand };
