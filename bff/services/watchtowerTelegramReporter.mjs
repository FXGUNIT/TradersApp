// bff/services/watchtowerTelegramReporter.mjs
// Telegram push for every Watchtower fault and resolution.

function istNow() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
}

export function formatFaultAlert({ fault, ownerAgent, correctiveAction, threadId }) {
  const severity = fault?.severity || "unknown";

  const lines = [
    `<b>Watchtower found a ${escapeHtml(severity)} problem.</b>`,
    `Agent: ${escapeHtml(ownerAgent || "unknown")}`,
    `Code: <code>${escapeHtml(fault?.code || "unknown")}</code>`,
    `What happened: ${escapeHtml(fault?.title || "No title")}`,
    fault?.detail ? `Details: ${escapeHtml(fault.detail)}` : "",
    correctiveAction ? `What I will do next: ${escapeHtml(correctiveAction)}` : "",
    threadId ? `Tracking thread: <code>${escapeHtml(threadId)}</code>` : "",
    `Found: ${istNow()} IST`,
  ].filter(Boolean);

  return lines.join("\n");
}

export function formatResolutionAlert({ code, title, ownerAgent, threadId, proof }) {
  const lines = [
    "<b>Watchtower closed a problem.</b>",
    `Agent: ${escapeHtml(ownerAgent || "unknown")}`,
    `Code: <code>${escapeHtml(code || "unknown")}</code>`,
    `What was fixed: ${escapeHtml(title || "No title")}`,
    threadId ? `Tracking thread: <code>${escapeHtml(threadId)}</code>` : "",
    `Resolved: ${istNow()} IST`,
    proof ? `Proof: ${escapeHtml(proof)}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

export async function notifyFault({ fault, ownerAgent, correctiveAction, threadId }) {
  const { boardRoomTelegram } = await import("./boardRoomTelegram.mjs");
  const text = formatFaultAlert({ fault, ownerAgent, correctiveAction, threadId });
  const result = await boardRoomTelegram.sendMessage(text);
  console.log(`[watchtowerTelegram] Fault alert sent: ${fault?.code || "unknown"} -> ${result.ok ? "OK" : result.error}`);
  return result;
}

export async function notifyResolved({ code, title, ownerAgent, threadId, proof }) {
  const { boardRoomTelegram } = await import("./boardRoomTelegram.mjs");
  const text = formatResolutionAlert({ code, title, ownerAgent, threadId, proof });
  const result = await boardRoomTelegram.sendMessage(text);
  console.log(`[watchtowerTelegram] Resolution alert sent: ${code || "unknown"} -> ${result.ok ? "OK" : result.error}`);
  return result;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default { notifyFault, notifyResolved, formatFaultAlert, formatResolutionAlert };
