// bff/services/boardRoomTelegram.mjs
// Telegram alert sender for Board Room HIGH/CRITICAL events

const TELEGRAM_API = 'https://api.telegram.org/bot';

function getTelegramConfig() {
  const token = process.env.BFF_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.BOARD_ROOM_TELEGRAM_CHAT_ID || process.env.BFF_TELEGRAM_CHAT_ID;
  if (!token) return { token: null, chatId: null };
  return { token, chatId };
}

async function sendTelegramMessage(text) {
  const { token, chatId } = getTelegramConfig();
  if (!token || !chatId) {
    console.warn('[boardRoomTelegram] Not configured — skipping Telegram alert');
    return { ok: false, reason: 'not configured' };
  }
  try {
    const response = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await response.json();
    return data.ok ? { ok: true, message_id: data.result?.message_id } : { ok: false, error: data.description };
  } catch (err) {
    console.error('[boardRoomTelegram] Telegram send failed:', err.message);
    return { ok: false, error: err.message };
  }
}

function formatAlert(params) {
  const { type, agent, threadId, threadTitle, target, what, why, priority, deadline } = params;
  const lines = [
    `&#128276; <b>BOARD ROOM ALERT</b>`,
    `Agent: ${agent}`,
    `Thread: ${threadId} — ${threadTitle}`,
    `Type: ${type}${priority ? ` (${priority})` : ''}`,
  ];
  if (target) lines.push(`Target: ${target}`);
  if (what) lines.push(`What: ${what}`);
  if (why) lines.push(`Why: ${why}`);
  if (deadline) {
    const d = new Date(deadline);
    const ist = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(d);
    lines.push(`Deadline: ${ist} IST`);
  }
  return lines.join('\n');
}

function formatEscalation(params) {
  const { agent, threadId, threadTitle, suggestionFrom, what, deadline } = params;
  const lines = [
    `&#128127; <b>BOARD ROOM ESCALATION</b>`,
    `Agent: ${agent} missed acknowledgment deadline`,
    `Thread: ${threadId} — ${threadTitle}`,
    `Suggestion from: ${suggestionFrom}`,
  ];
  if (what) lines.push(`What: ${what}`);
  if (deadline) {
    const d = new Date(deadline);
    const ist = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(d);
    lines.push(`Deadline: ${ist} IST`);
  }
  lines.push('', `<b>Action required from CEO</b>`);
  return lines.join('\n');
}

function formatDigest(digest) {
  const { date, activeCount, needsAction, staleThreads, lateAcks, inactiveAgents } = digest;
  const lines = [
    `&#128203; <b>BOARD ROOM WEEKLY DIGEST</b> — ${date}`,
    `Active threads: ${activeCount}`,
    needsAction.length ? `Needs your action: ${needsAction.join(', ')}` : `Needs your action: 0`,
    staleThreads.length ? `Stale threads: ${staleThreads.map(t => `${t.id} (${t.days}d inactive)`).join(', ')}` : `Stale threads: 0`,
    lateAcks.length ? `Late acks this week: ${lateAcks.length} (${lateAcks.map(a => a.agent).join(', ')})` : `Late acks this week: 0`,
    inactiveAgents.length ? `Inactive agents (>24h): ${inactiveAgents.join(', ')}` : `All agents active`,
  ];
  return lines.join('\n');
}

export const boardRoomTelegram = {
  sendMessage: (text) => sendTelegramMessage(text),
  sendAlert: (params) => sendTelegramMessage(formatAlert(params)),
  sendEscalation: (params) => sendTelegramMessage(formatEscalation(params)),
  sendDigest: (digest) => sendTelegramMessage(formatDigest(digest)),
};
export default boardRoomTelegram;
