import { useEffect, useRef, useState, useCallback } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap.js";
import { onValue, push, ref, set } from "firebase/database";
import { resolveBffBaseUrl } from "../../services/runtimeConfig.js";

const BFF_BASE = resolveBffBaseUrl();

export default function SupportChatModal({
  isOpen,
  userId,
  userName,
  userEmail,
  onClose,
  auth,
  showToast,
  firebaseDb,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const canUseDb = Boolean(firebaseDb);
  const chatPath = `support_chats/${userId}`;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── Real-time listener on Firebase RTDB ──────────────────────────────
  useEffect(() => {
    if (!isOpen || !userId || !canUseDb) return undefined;

    const messagesRef = ref(firebaseDb, `${chatPath}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const nextMessages = Object.entries(data)
          .map(([, message]) => message)
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setMessages(nextMessages);
      } else {
        setMessages([]);
      }
    });

    return () => { unsubscribe(); };
  }, [isOpen, userId, chatPath, canUseDb, firebaseDb]);

  // ── Send message ─────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const text = input.trim();
    setInput("");
    setIsTyping(false);
    clearTimeout(typingTimeoutRef.current);

    // Write to Firebase RTDB (real-time — user sees it immediately + admin sees it)
    if (canUseDb) {
      try {
        const messagesRef = ref(firebaseDb, `${chatPath}/messages`);
        const newMessageRef = push(messagesRef);
        await set(newMessageRef, {
          sender: "user",                              // ← user sending, not admin
          senderName: userName || auth?.displayName || "User",
          senderEmail: userEmail || auth?.email || "",
          text,
          timestamp: Date.now(),
          read: false,
          fromTelegram: false,
        });
      } catch (e) {
        console.error("[SupportChatModal] Firebase write failed:", e);
        showToast?.("Failed to send. Try again.", "error");
        return;
      }
    }

    // Notify admin via Telegram BFF (non-blocking)
    try {
      await fetch(`${BFF_BASE}/support/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userEmail: userEmail || auth?.email || "",
          userName: userName || auth?.displayName || "User",
          text,
        }),
      });
    } catch {
      // Non-fatal — Firebase RTDB already saved the message
    }
  };

  // ── Typing indicator ─────────────────────────────────────────────────
  const handleTyping = (text) => {
    setInput(text);

    if (!auth?.uid || !canUseDb) return;

    clearTimeout(typingTimeoutRef.current);
    setIsTyping(true);
    set(ref(firebaseDb, `${chatPath}/typing_${auth.uid}`), true);

    typingTimeoutRef.current = setTimeout(() => {
      set(ref(firebaseDb, `${chatPath}/typing_${auth.uid}`), null);
      setIsTyping(false);
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
      }}
    >
      <div
        style={{
          background: "rgba(20,20,25,0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          width: "90%",
          maxWidth: 500,
          height: 600,
          display: "flex",
          flexDirection: "column",
          backdropFilter: "blur(30px)",
        }}
        className="restored-modal"
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ color: "#F2F2F7", fontSize: 14, fontWeight: 600 }}>
              {userName || "Support Chat"}
            </div>
            <div style={{ color: "#30D158", fontSize: 11, marginTop: 2 }}>
              {canUseDb ? "Connected" : "Offline mode"}
              {isTyping && (
                <span style={{ color: "#0A84FF", marginLeft: 6 }}>typing...</span>
              )}
              {otherUserTyping && (
                <span style={{ color: "#0A84FF", marginLeft: 6 }}>Support is typing...</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#A1A1A6",
              fontSize: 24,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                color: "var(--text-secondary, #A1A1A6)",
                textAlign: "center",
                marginTop: 20,
                lineHeight: 1.6,
              }}
            >
              No messages yet.<br />
              <span style={{ fontSize: 11 }}>
                Start the conversation — an admin will reply via Telegram.
              </span>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isAdmin = msg.sender === "admin";
              return (
                <div
                  key={`msg_${msg.timestamp}_${idx}`}
                  style={{
                    display: "flex",
                    justifyContent: isAdmin ? "flex-end" : "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      background: isAdmin
                        ? "rgba(0,122,255,0.3)"
                        : "rgba(48,209,88,0.15)",
                      border: `1px solid ${
                        isAdmin
                          ? "rgba(0,122,255,0.5)"
                          : "rgba(48,209,88,0.25)"
                      }`,
                      borderRadius: 12,
                      padding: "10px 14px",
                      maxWidth: "80%",
                      wordWrap: "break-word",
                    }}
                  >
                    {!isAdmin && (
                      <div
                        style={{
                          color: "#636366",
                          fontSize: 10,
                          marginBottom: 4,
                          fontWeight: 600,
                        }}
                      >
                        {msg.senderName || msg.senderEmail || "You"}
                      </div>
                    )}
                    {isAdmin && (
                      <div
                        style={{
                          color: "#0A84FF",
                          fontSize: 10,
                          marginBottom: 4,
                          fontWeight: 600,
                        }}
                      >
                        {msg.senderName || "Support Team"}
                        {msg.fromTelegram && (
                          <span style={{ color: "#30D158", marginLeft: 4, fontSize: 9 }}>
                            via Telegram
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      style={{
                        color: "var(--text-primary, #F2F2F7)",
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      {msg.text}
                    </div>
                    <div
                      style={{
                        color: "#636366",
                        fontSize: 9,
                        marginTop: 4,
                        textAlign: isAdmin ? "right" : "left",
                      }}
                    >
                      {msg.timestamp
                        ? new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            gap: 12,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(event) => handleTyping(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type your message..."
            style={{
              flex: 1,
              background: "var(--input-bg, rgba(255,255,255,0.05))",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 12px",
              color: "#F2F2F7",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim()}
            style={{
              background: input.trim()
                ? "var(--accent-primary, #2563eb)"
                : "rgba(0,122,255,0.3)",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              color: input.trim()
                ? "#fff"
                : "var(--text-secondary, #A1A1A6)",
              fontSize: 13,
              fontWeight: 700,
              cursor: input.trim() ? "pointer" : "default",
              transition: "all 0.2s",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
