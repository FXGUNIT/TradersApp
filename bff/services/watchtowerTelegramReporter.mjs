// bff/services/watchtowerTelegramReporter.mjs
// Telegram push for every Watchtower fault and resolution.
// Uses boardRoomTelegram.sendAlert() under the hood.

function istNow() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
}

/**
 * Format a Watchtower fault as a Telegram alert.
 */
export function formatFaultAlert({ fault, ownerAgent, correctiveAction, threadId }) {
  const severityEmoji = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🟢",
  }[fault.severity] || "⚪";

  const lines = [
    `&#128275; <b>WATCHTOWER FAULT DETECTED</b>`,
    `&#128276; Agent: ${ownerAgent}`,
    `${severityEmoji} <b>${fault.code}</b>`,
    `Title: ${fault.title}`,
    `Detail: ${fault.detail || "—"}`,
    `Fix: ${correctiveAction}`,
    threadId ? `Thread: ${threadId}` : "",
    `Found: ${istNow()} IST`,
  ].filter(Boolean);

  return lines.join("\n");
}

/**
 * Format a resolution event as a Telegram alert.
 */
export function formatResolutionAlert({ code, title, ownerAgent, threadId, proof }) {
  const lines = [
    `&#9989; <b>WATCHTOWER — FAULT RESOLVED</b>`,
    `&#128276; Agent: ${ownerAgent}`,
    `Code: ${code}`,
    `Title: ${title}`,
    `Thread: ${threadId || "—"}`,
    `Resolved: ${istNow()} IST`,
    proof ? `Proof: ${proof}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

/**
 * Send a Telegram alert for a newly detected fault.
 */
export async function notifyFault({ fault, ownerAgent, correctiveAction, threadId }) {
  const { boardRoomTelegram } = await import("./boardRoomTelegram.mjs");
  const text = formatFaultAlert({ fault, ownerAgent, correctiveAction, threadId });
  const result = await boardRoomTelegram.sendMessage(text);
  console.log(`[watchtowerTelegram] Fault alert sent: ${fault.code} → ${result.ok ? "OK" : result.error}`);
  return result;
}

/**
 * Send a Telegram alert when a fault is resolved.
 */
export async function notifyResolved({ code, title, ownerAgent, threadId, proof }) {
  const { boardRoomTelegram } = await import("./boardRoomTelegram.mjs");
  const text = formatResolutionAlert({ code, title, ownerAgent, threadId, proof });
  const result = await boardRoomTelegram.sendMessage(text);
  console.log(`[watchtowerTelegram] Resolution alert sent: ${code} → ${result.ok ? "OK" : result.error}`);
  return result;
}

export default { notifyFault, notifyResolved, formatFaultAlert, formatResolutionAlert };
