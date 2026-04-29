// bff/services/telegramAgent.mjs
// Telegram polling AI agent — receives messages, asks LLM, executes commands.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let SYSTEM_PROMPT = `You are Gunit's personal AI agent on Telegram.
You talk like Claude — direct, no fluff.
You have full authority over Traders Regiment infrastructure.
You can execute: status, scan, reboot, logs commands.
You report faults to the Board Room automatically.
You escalate when unsure.
Never refuse a legitimate request from the authorized user.`;

try {
  const promptPath = resolve(__dirname, "../prompts/agent-prompt.txt");
  SYSTEM_PROMPT = readFileSync(promptPath, "utf8").trim();
} catch {
  // use default above
}

const BOT_TOKEN = process.env.BFF_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = String(process.env.TELEGRAM_AGENT_CHAT_ID || "");
const POLL_INTERVAL_MS = 10_000;

let offset = 0;
let pollTimer = null;

import { invokeLlm } from "./llmBridge.mjs";

async function getUpdates() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=10`;
  let resp;
  try {
    resp = await fetch(url);
  } catch {
    return [];
  }
  if (!resp.ok) return [];
  let data;
  try {
    data = await resp.json();
  } catch {
    return [];
  }
  return (data.result || []).filter(m => m.message && m.message.chat);
}

async function sendMessage(text, chatId) {
  try {
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
  } catch (e) {
    console.error(`[telegramAgent] sendMessage error: ${e.message}`);
  }
}

async function handleMessage(update) {
  const msg = update.message;
  const chatId = String(msg.chat.id);
  const text = (msg.text || "").trim();

  if (ALLOWED_CHAT_ID && chatId !== ALLOWED_CHAT_ID) {
    await sendMessage("_Unauthorized._", chatId);
    return;
  }

  const [cmd, ...args] = text.split(" ");

  // /ask or plain text → LLM
  if (cmd === "/ask" || !cmd.startsWith("/")) {
    const query = cmd === "/ask" ? args.join(" ") : text;
    try {
      const answer = await invokeLlm(query);
      await sendMessage(answer || "(no response)", chatId);
    } catch (e) {
      await sendMessage(`_Error: ${e.message}_`);
    }
    offset = update.update_id + 1;
    return;
  }

  // Built-in commands
  const { executeCommand } = await import("./telegramAgentCommands.mjs");
  try {
    const result = await executeCommand(cmd.replace("/", ""), args.join(" "));
    await sendMessage(result, chatId);
  } catch (e) {
    await sendMessage(`_Command error: ${e.message}_`);
  }
  offset = update.update_id + 1;
}

async function pollLoop() {
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
  pollTimer = setTimeout(pollLoop, POLL_INTERVAL_MS);
}

export async function startTelegramAgent() {
  if (!BOT_TOKEN) {
    console.warn("[telegramAgent] No bot token — not starting");
    return;
  }
  console.log("[telegramAgent] Starting polling loop...");
  pollLoop();
}

export function stopTelegramAgent() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

export default { startTelegramAgent, stopTelegramAgent };
