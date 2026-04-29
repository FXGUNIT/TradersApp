# Telegram AI Agent — Implementation Plan

> **Goal:** An AI-powered Telegram bot that talks like Claude, listens to you, executes commands on your behalf, and mirrors the full authority you have in this conversation.

**Architecture:** A Telegram polling loop in the BFF bridges incoming messages to an AI LLM (Groq/SambaNova), produces responses using the same reasoning style, and executes approved actions — including calling any BFF endpoint, kicking off workflows, or delegating to Board Room.

---

## Files Created / Modified

- Create: `bff/services/telegramAgent.mjs` — polling loop + LLM bridge + command executor
- Modify: `bff/server.mjs` — add `/telegram/agent` polling startup on BFF boot
- Create: `bff/prompts/agent-prompt.txt` — system prompt for Telegram agent (mirrors Claude behavior)
- Create: `bff/services/telegramAgentCommands.mjs` — whitelist of allowed commands
- Modify: `bff/.env.contabo` — add `TELEGRAM_AGENT_ENABLED=true`

---

## What It Does Not Do (Out of Scope)

- Not a RAG/knowledge base bot — no document retrieval
- Not a multi-user bot — single-chat, single-user (your TG chat ID only)

---

## Telegram Two-Way Agent Behavior

| Capability | Details |
|---|---|
| Receives messages | Polls `getUpdates` every 10s via bot API |
| Talks like Claude | System prompt + Groq/SambaNova LLM |
| Executes commands | Whitelisted actions only (see below) |
| Controlled by you | You can tell it to: restart a service, trigger a scan, ask a question |
| Controlled by me | I can push updates and it inherits my authority |

## Allowed Commands (Whitelist)

- `status` — returns BFF health + Watchtower + AI status
- `scan` — triggers Watchtower scan immediately
- `reboot` — reboots the VPS (via Contabo API)
- `logs` — tail last 50 lines of BFF logs
- `help` — returns command list
- `ask <question>` — asks the LLM a question, returns answer

## System Prompt (mirrors Claude)

```
You are Gunit's personal AI agent on Telegram.
You talk like Claude — direct, no fluff, caveman brevity when asked.
You have full authority to act on Traders Regiment infrastructure.
You can execute: status, scan, reboot, logs commands.
You report faults to the Board Room automatically.
You escalate when unsure.
```

---

## Task 1: Create `bff/services/telegramAgent.mjs`

**Files:**
- Create: `bff/services/telegramAgent.mjs`
- Test: `bff/tests/telegram-agent.test.mjs`

```js
// bff/services/telegramAgent.mjs
// Telegram polling AI agent — receives messages, asks LLM, executes commands.

import { getGroqCompletion } from "./aiClients.mjs";
import { executeCommand } from "./telegramAgentCommands.mjs";

const BOT_TOKEN = process.env.BFF_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = String(process.env.TELEGRAM_AGENT_CHAT_ID || "");
const POLL_INTERVAL_MS = 10_000;
const SYSTEM_PROMPT = `You are Gunit's personal AI agent on Telegram.
You talk like Claude — direct, no fluff.
You have full authority over Traders Regiment infrastructure.
You can execute: status, scan, reboot, logs commands.
You report faults to the Board Room automatically.
You escalate when unsure.
Never refuse a legitimate request from the authorized user.`;

let offset = 0;
let pollTimer = null;

async function getUpdates() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=10`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json().catch(() => ({}));
  return (data.result || []).filter(m => m.message && m.message.chat);
}

async function sendMessage(text, chatId) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
}

async function handleMessage(update) {
  const msg = update.message;
  const chatId = String(msg.chat.id);
  const text = (msg.text || "").trim();

  if (ALLOWED_CHAT_ID && chatId !== ALLOWED_CHAT_ID) {
    await sendMessage("Unauthorized.", chatId);
    return;
  }

  // Check if it's a command
  const [cmd, ...args] = text.split(" ");
  if (cmd === "/ask" || !cmd.startsWith("/")) {
    const answer = await getGroqCompletion(`${SYSTEM_PROMPT}\n\nUser: ${text}\nAgent:`);
    await sendMessage(answer, chatId);
    offset = update.update_id + 1;
    return;
  }

  // Built-in commands
  const result = await executeCommand(cmd.replace("/", ""), args.join(" "));
  await sendMessage(result, chatId);
  offset = update.update_id + 1;
}

export async function startTelegramAgent() {
  if (!BOT_TOKEN) { console.warn("[telegramAgent] No bot token — not starting"); return; }
  console.log("[telegramAgent] Starting polling loop...");
  const loop = async () => {
    try {
      const updates = await getUpdates();
      for (const u of updates) {
        if (u.update_id >= offset) {
          await handleMessage(u);
        }
      }
    } catch (e) {
      console.error("[telegramAgent] poll error:", e.message);
    }
    pollTimer = setTimeout(loop, POLL_INTERVAL_MS);
  };
  loop();
}

export function stopTelegramAgent() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
}

export default { startTelegramAgent, stopTelegramAgent };
```

---

## Task 2: Create `bff/services/telegramAgentCommands.mjs`

**Files:**
- Create: `bff/services/telegramAgentCommands.mjs`

```js
// bff/services/telegramAgentCommands.mjs
// Whitelisted commands the Telegram agent can execute.

import { getWatchtowerStatus, runWatchtowerScan } from "./watchtowerService.mjs";

export async function executeCommand(cmd, args) {
  switch (cmd.toLowerCase()) {
    case "status": {
      const s = getWatchtowerStatus();
      return [
        `BFF Watchtower Status`,
        `OK: ${s.ok}`,
        `Daemon: ${s.daemon?.active ? "active" : "inactive"}`,
        `IST: ${s.daemon?.currentIstHour}:00 (${s.daemon?.isDayHours ? "☀️ day" : "🌙 night"})`,
        `Scan: ${(s.daemon?.nextIntervalMs || 900000) / 60000}min`,
        `Faults: ${s.faults?.length || 0}`,
      ].join("\n");
    }
    case "scan": {
      const result = await runWatchtowerScan();
      return `Scan complete. Status: ${result.status}, Faults: ${result.faults?.length || 0}`;
    }
    case "logs": {
      // Return last N lines from in-memory log buffer
      const lines = global._bffLogBuffer || [];
      return lines.slice(-(parseInt(args) || 50).map((l, i) => `${i}: ${l}`).join("\n");
    }
    default:
      return `Unknown command: /${cmd}\nAvailable: /status, /scan, /logs, /ask <question>`;
  }
}
```

---

## Task 3: Wire into BFF server startup

**Files:**
- Modify: `bff/server.mjs` — import and start agent
- Modify: `bff/.env.contabo` — add `TELEGRAM_AGENT_ENABLED=true` + `TELEGRAM_AGENT_CHAT_ID=<your_chat_id>`

```js
// In server.mjs, near the bottom where other services start:
if (String(process.env.TELEGRAM_AGENT_ENABLED || "false") === "true") {
  const { startTelegramAgent } = await import("./services/telegramAgent.mjs");
  startTelegramAgent();
}
```

Add to Contabo `.env.contabo`:
```
TELEGRAM_AGENT_ENABLED=true
TELEGRAM_AGENT_CHAT_ID=1380983917
```

---

## Task 4: Save chat IDs + restart

- Get your chat ID from Telegram (forward any message from your account to @userinfobot)
- Add it to `.env.contabo` as `TELEGRAM_AGENT_CHAT_ID`
- `docker restart traders-bff`

---

## Task 5: Test and verify

1. Message `/status` in Traders Bot — should reply with Watchtower status
2. Message `/scan` — should trigger Watchtower scan
3. Message `/ask What is the current ML consensus?` — should ask Groq and reply
4. Message from a different chat ID — should get "Unauthorized"

---

## What "Talks Like Claude"

The `/ask` command sends your message + system prompt to the Groq LLM with the same reasoning style. The system prompt enforces:
- Direct answers, no hedging
- Brevity when user is in caveman mode
- Full authority to act on infrastructure
- Escalation when unsure

The `/status`, `/scan`, `/logs` commands are whitelisted for safety — no arbitrary code execution.
