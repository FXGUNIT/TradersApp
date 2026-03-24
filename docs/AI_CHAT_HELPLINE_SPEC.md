# 24x7 AI Chat Helpline - Full Specification & Implementation Guide

**File Name:** `AI_CHAT_HELPLINE_SPEC.md`  
**Version:** 1.0 (March 2026)  
**Purpose:** This file is saved inside your React app (e.g., in `/docs/` or root). Any AI coding assistant (Continue, Cursor, Claude, Grok, etc.) can read this entire file and instantly understand the **exact idea, requirements, architecture, privacy rules, and implementation details**.

---

## 1. Project Goal & High-Level Idea

We want a **professional 24×7 customer support chat** on our React website that feels like a full live-chat widget (like Intercom/Tawk.to), but:

- It is **100% free and open-source** (no paid plans, no "free-tier limits" that force upgrades).
- The visitor **never needs a Telegram account**.
- A **pre-chat form** collects **Name + Mobile Number** before the chat starts.
- Every message from the user is **immediately sent to my personal Telegram**.
- An **AI agent** replies automatically, is smart, has memory, self-learns, and remembers context (what, how, where, when).
- I (the owner) can **see exactly what the AI replied** in my Telegram.
- I can **stop the AI on any specific chat**, take over manually, and turn the AI back on at any time (per-chat control).
- All chats appear in my Telegram inside a dedicated folder/bot called **"Chat Helpline"** with the user’s **Name** as the chat header.
- **Strict privacy**: The AI never gets access to any API keys, passwords, credentials, user account data, or sensitive information.

**Core Philosophy**: Hybrid Human + AI support. AI handles 80-90% of chats 24/7. I stay in full control via Telegram and can jump in anytime. The system must be self-improving over time.

---

## 2. Exact Requirements (User’s Words)

- Floating button titled **"24×7 Chat Help"** in the **bottom-right** corner of the website.
- When clicked → chat window opens **directly on the website**.
- Pre-chat form that asks for **Name** and **Mobile Number** (required) before the chat starts.
- After form submission, a new chat session begins and appears in my Telegram as a new conversation with the user’s **Name** as the header.
- All conversations are grouped inside a Telegram folder/bot named **"Chat Helpline"**.
- Every user message is instantly forwarded to my Telegram.
- AI replies automatically on my behalf.
- I must see **exactly what the AI answered** in my Telegram (so I know what was said on my behalf).
- I must have the ability to **stop AI in a particular chat**, reply manually, and **turn AI back on** whenever I want (per-chat toggle).
- The AI must be **smart**, have **conversation memory**, remember context across messages, and **self-learn** (improve over time using knowledge base + past conversations).
- The AI must remember **what, how, where, and when** things were done in previous chats.
- **Privacy rule (non-negotiable)**: The AI must **never** have access to any API keys, passwords, user account data, credentials, or sensitive information. All sensitive data stays only on my side.

---

## 3. Architecture Overview (100% Free + Open-Source)

**No server required from you** — we use only free public services + open-source code you can copy-paste.

- **Frontend** → Custom open-source React chat widget (Tailwind + Lucide icons)
- **Pre-chat form** → Built into the widget
- **AI Brain** → Groq (free Llama 3.1 70B or Mixtral) + LangChain-style memory (open-source)
- **Bridge** → n8n **self-hosted on free platform** (Railway Hobby / Render Free / Fly.io free tier) or pure Make.com free tier (but we prefer open-source n8n)
- **Telegram Integration** → Official Telegram Bot API (free + open)
- **Knowledge Base** → Simple JSON or Markdown files you maintain (self-learning)

Everything is open-source or completely free public APIs. No paid subscriptions are used.

---

## 4. Tech Stack (All 100% Free / Open-Source)

| Component                 | Tool / Library                            | Why (100% free/open-source)                  |
| ------------------------- | ----------------------------------------- | -------------------------------------------- |
| React Chat Widget         | Custom component (Tailwind + Lucide)      | Fully open-source, no external branding      |
| Pre-chat Form             | Built-in React state                      | No external service                          |
| AI Model                  | Groq + Llama 3.1 70B / Mixtral            | Completely free generous tier + open weights |
| AI Memory & Self-learning | LangChain.js + simple vector store (JSON) | Open-source                                  |
| Workflow / Bridge         | n8n (self-hosted on free Railway/Render)  | 100% open-source                             |
| Telegram Forwarding       | Telegram Bot API + n8n node               | Free & open                                  |
| Knowledge Base            | Markdown/JSON files in your repo          | You control everything                       |

---

## 5. Detailed Flow (Step by Step)

1. Visitor clicks floating button → Pre-chat form appears (Name + Mobile required).
2. Form submitted → New chat session created on website.
3. n8n receives the start event + user details.
4. n8n creates a new Telegram chat (or forwards to your bot) titled with the user’s **Name** and places it in **"Chat Helpline"** folder.
5. Every user message → sent to n8n → sent to Groq AI (with full conversation history + knowledge base).
6. AI reply → sent back to website **and** forwarded to your Telegram so you see exactly what AI said.
7. You can reply manually from Telegram → n8n detects your message and disables AI for that chat only.
8. You can send a special command (e.g., `/ai on` or `/ai off`) in that Telegram chat to toggle AI.
9. AI has persistent memory per chat (stored in n8n or simple JSON).

---

## 6. Privacy & Security Rules (Hard-Coded)

- The AI prompt **explicitly forbids** asking for or storing any credentials, passwords, API keys, payment info, or account data.
- All sensitive data (your Telegram token, Groq key if used) is stored **only in n8n environment variables** on the free hosting platform — never sent to the AI model.
- The AI only receives: user message + conversation history + public knowledge base.
- No user data is ever stored in the AI model itself.

---

## 7. AI Self-Learning & Memory

- **Short-term memory**: Full conversation history is kept per chat session.
- **Long-term memory**: Knowledge base (Markdown files) + simple vector store (you can add past resolved conversations manually).
- The system prompt includes: "You learn from every conversation. Remember what worked, what the user liked, and improve future answers."
- You can periodically add resolved chats to the knowledge base so the AI gets smarter over time.

---

## 8. Implementation - React Widget Code (Copy-Paste Ready)

Save this as `components/ChatHelpline.tsx` in your React/Next.js app:

```tsx
"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, X, MessageCircle } from "lucide-react";

export default function ChatHelpline() {
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mobile) return;
    setShowForm(false);
    // Send start event to n8n webhook with name + mobile
    fetch("https://your-n8n-webhook-url/webhook/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mobile, page: window.location.href }),
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    // ... (full send logic to n8n webhook - add your webhook URL)
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center z-50"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Window + Form + Messages */}
      {/* Full UI code can be expanded here - the AI coder will complete it based on this spec */}
    </>
  );
}
```
