/**
 * Bot Broadcast & Admin Routes
 *
 * Broadcast routes, user registry management, admin invite system,
 * and Telegram event notification routes.
 */

import { bot, adminChats, userRegistry, saveUserRegistry, getSubscribedUsers } from "./botState.js";
import { getBotStatus } from "./botCommands.js";
import * as invitesService from "./invitesService.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Admin Forward Helper ────────────────────────────────────────────────────

/**
 * Forward a message to all admin chats.
 * @param {string} text
 */
export async function forwardToAdmins(text) {
  if (!bot || adminChats.length === 0) return;
  for (const chat of adminChats) {
    try {
      await bot.sendMessage(chat, text, { parse_mode: "HTML" });
    } catch (e) {
      console.error("Telegram forward error", e);
    }
  }
}

// ─── Telegram Broadcast Routes ────────────────────────────────────────────────

/**
 * POST /telegram/notify — forward an event to all admin chats.
 * @param {import("express").Express} app
 */
export function registerBroadcastRoutes(app) {
  // ── Notify admin ──────────────────────────────────────────────────────────
  app.post("/telegram/notify", (req, res) => {
    const headerKey = req.headers["x-telegram-webhook-key"];
    if (
      process.env.TELEGRAM_WEBHOOK_KEY &&
      headerKey !== process.env.TELEGRAM_WEBHOOK_KEY
    ) {
      return res.status(403).json({ ok: false, error: "Invalid webhook key" });
    }
    const { event, payload } = req.body || {};
    const message =
      `<b>LIVE EVENT</b> - ${event || "UNKNOWN"}<br/>` +
      (payload
        ? Object.entries(payload)
            .map(([k, v]) => `<b>${k}</b>: ${v}`)
            .join("<br/>")
        : "");
    forwardToAdmins(message).catch(console.error);
    res.json({ ok: true });
  });

  // ── Broadcast to all subscribed users ─────────────────────────────────────
  app.post("/telegram/broadcast", async (req, res) => {
    const { message, parse_mode = "HTML", dry_run = false } = req.body || {};
    if (!message)
      return res.status(400).json({ ok: false, error: "message required" });

    const users = getSubscribedUsers();
    if (users.length === 0) {
      return res.json({
        ok: true,
        sent: 0,
        skipped: 0,
        message: "No subscribed users found.",
      });
    }

    const header = `<b>📢 TradersApp Announcement</b>\n\n`;
    const fullMessage = header + message;

    if (dry_run) {
      return res.json({
        ok: true,
        dry_run: true,
        recipients: users.length,
        preview: fullMessage.slice(0, 200),
      });
    }

    let sent = 0, skipped = 0;
    for (const user of users) {
      try {
        await bot.sendMessage(user.chatId, fullMessage, {
          parse_mode,
          disable_web_page_preview: true,
        });
        sent++;
        // Rate limit: max 30 msgs/sec (Telegram limit), sleep 35ms between messages
        await new Promise((r) => setTimeout(r, 35));
      } catch (e) {
        skipped++;
        console.error(
          `[broadcast] Failed to send to ${user.chatId} (${user.username}):`,
          e.message,
        );
      }
    }

    console.log(
      `[broadcast] Sent ${sent}/${users.length} messages, ${skipped} skipped`,
    );
    res.json({ ok: true, sent, skipped, total: users.length });
  });

  // ── Telegram status ────────────────────────────────────────────────────────
  app.get("/telegram/status", (req, res) => {
    res.json({
      ...getBotStatus(),
      providers: 0, // no longer exposed from aiConversation here
    });
  });

  // ── Diagnostic notify test ─────────────────────────────────────────────────
  app.get("/telegram/notify-test", async (req, res) => {
    try {
      const msg = "TEST MESSAGE: Telegram bridge is reachable";
      await forwardToAdmins(msg);
      res.json({ ok: true, message: msg });
    } catch (e) {
      res.status(500).json({ ok: false, error: e?.message || "test failed" });
    }
  });
}

// ─── User Registry Routes ─────────────────────────────────────────────────────

/**
 * @param {import("express").Express} app
 */
export function registerUserRoutes(app) {
  app.get("/telegram/users", (req, res) => {
    const users = Object.values(userRegistry);
    res.json({
      ok: true,
      total: users.length,
      subscribed: users.filter((u) => u.subscribed).length,
      users: users.map((u) => ({
        chatId: u.chatId,
        username: u.username,
        firstName: u.firstName,
        lastSeen: new Date(u.lastSeen).toISOString(),
        subscribed: u.subscribed,
      })),
    });
  });

  app.patch("/telegram/users/:chatId", (req, res) => {
    const { chatId } = req.params;
    const { subscribed } = req.body || {};
    if (userRegistry[chatId]) {
      userRegistry[chatId].subscribed = subscribed;
      saveUserRegistry();
      return res.json({ ok: true, user: userRegistry[chatId] });
    }
    res.status(404).json({ ok: false, error: "User not found" });
  });
}

// ─── Admin Invite Routes ─────────────────────────────────────────────────────

const invitesPath = path.resolve(__dirname, "invites.json");

function readInvites() {
  try {
    return JSON.parse(fs.readFileSync(invitesPath, "utf8"));
  } catch {
    return [];
  }
}

function writeInvites(data) {
  fs.writeFileSync(invitesPath, JSON.stringify(data, null, 2));
}

function ensureInvitesFile() {
  if (!fs.existsSync(invitesPath)) writeInvites([]);
}

/**
 * @param {import("express").Express} app
 */
export function registerInviteRoutes(app) {
  app.post("/admin/invite", async (req, res) => {
    const { email, name } = req.body || {};
    if (!email)
      return res.status(400).json({ ok: false, error: "email required" });
    const invite = {
      email,
      name: name || email,
      status: "PENDING",
      createdAt: Date.now(),
    };
    try {
      const created = await invitesService.createInvite({
        email: invite.email,
        name: invite.name,
      });
      invite.id = created.id;
      invite.docRef = created.docRef;
      if (adminChats.length)
        forwardToAdmins(
          `New invite requested: ${email} (${invite.name}) [${invite.id}]`,
        );
      res.json({ ok: true, invite });
    } catch {
      ensureInvitesFile();
      const existing = readInvites();
      const id = "INV-" + Date.now();
      const localInvite = {
        id,
        email: invite.email,
        name: invite.name,
        status: invite.status,
        createdAt: invite.createdAt,
      };
      existing.unshift(localInvite);
      writeInvites(existing);
      invite.id = id;
      if (adminChats.length)
        forwardToAdmins(
          `New invite requested: ${email} (${invite.name}) [${id}]`,
        );
      res.json({ ok: true, invite: localInvite });
    }
  });

  app.post("/admin/approve", async (req, res) => {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "id required" });
    // Forward declaration — resolved lazily from index.js
    let invite;
    // eslint-disable-next-line no-use-before-define
    const sendWelcomeEmail = globalThis.__sendWelcomeEmail;

    if (globalThis.__adminDb2) {
      try {
        const found = await invitesService.findInviteById(id, globalThis.__adminDb2);
        if (!found)
          return res.status(404).json({ ok: false, error: "not found" });
        invite = found;
        await invitesService.approveInvite(id, globalThis.__adminDb2);
        if (adminChats.length)
          forwardToAdmins(
            `Invite approved: ${invite?.email} (${invite?.name}) [${id}]`,
          );
        if (invite?.email && sendWelcomeEmail) {
          try { await sendWelcomeEmail(invite.email, invite.name); } catch {}
        }
        return res.json({
          ok: true,
          invite: { ...invite, status: "APPROVED", approvedAt: Date.now() },
        });
      } catch (e) {
        console.error("Firestore approve failed", e);
        return res.status(500).json({ ok: false, error: "db error" });
      }
    } else {
      ensureInvitesFile();
      const invites = readInvites();
      const idx = invites.findIndex((i) => i.id === id);
      if (idx < 0)
        return res.status(404).json({ ok: false, error: "not found" });
      invites[idx].status = "APPROVED";
      invites[idx].approvedAt = Date.now();
      writeInvites(invites);
      invite = invites[idx];
    }
    if (adminChats.length)
      forwardToAdmins(
        `Invite approved: ${invite?.email} (${invite?.name}) [${id}]`,
      );
    if (invite?.email && sendWelcomeEmail) {
      try { await sendWelcomeEmail(invite.email, invite.name); } catch {}
    }
    res.json({
      ok: true,
      invite: { ...invite, status: "APPROVED", approvedAt: Date.now() },
    });
  });

  app.post("/admin/passwordreset", (req, res) => {
    const { email } = req.body || {};
    if (!email)
      return res.status(400).json({ ok: false, error: "email required" });
    forwardToAdmins(`Password reset requested for ${email}`);
    res.json({ ok: true });
  });

  app.post("/admin/welcome", (req, res) => {
    const { email } = req.body || {};
    if (!email)
      return res.status(400).json({ ok: false, error: "email required" });
    forwardToAdmins(`Welcome email triggered for ${email}`);
    res.json({ ok: true });
  });

  app.get("/admin/list_invites", async (req, res) => {
    if (globalThis.__adminDb2) {
      try {
        const snapshot = await globalThis.__adminDb2
          .collection("invites")
          .orderBy("createdAt", "desc")
          .get();
        const list = snapshot.docs.map((doc) => doc.data());
        return res.json(list);
      } catch (e) {
        console.error("Firestore list_invites failed", e);
      }
    }
    ensureInvitesFile();
    res.json(readInvites());
  });
}
