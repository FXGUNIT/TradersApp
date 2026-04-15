import React, { useCallback, useEffect, useRef, useState } from "react";
import { Phone, Send, User } from "lucide-react";
import SupportClient from "../services/clients/SupportClient.js";

const panelBg = "var(--surface-glass, rgba(18,20,28,0.92))";
const panelAlt = "var(--surface-elevated, rgba(15,23,42,0.95))";
const border = "var(--border-subtle, rgba(255,255,255,0.08))";
const textPrimary = "var(--text-primary, #F2F2F7)";
const textSecondary = "var(--text-secondary, #94A3B8)";

export default function FloatingChatWidget({ auth, profile }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreChatForm, setShowPreChatForm] = useState(true);
  const [userInfo, setUserInfo] = useState({ name: "", mobile: "" });
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [, setSendError] = useState(false);
  const messagesEndRef = useRef(null);

  const userId = auth?.uid || profile?.uid || "anonymous";
  const userEmail = profile?.email || auth?.email || "Unknown";

  const injectWelcomeMessage = useCallback(async () => {
    if (isInitialized || !userId) return;
    setIsInitialized(true);
    await SupportClient.ensureWelcomeMessage(userId, userEmail);
  }, [isInitialized, userEmail, userId]);

  const handleFormSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!userInfo.name.trim() || !userInfo.mobile.trim()) return;

      setShowPreChatForm(false);
      await SupportClient.notifyStartWebhook({
        name: userInfo.name.trim(),
        mobile: userInfo.mobile.trim(),
        pageUrl: window.location.href,
        startedAt: new Date().toISOString(),
      });

      setMessages([
        {
          id: "welcome",
          text: `Hi ${userInfo.name}! I'm your 24x7 AI assistant. How can I help you today?`,
          sender: "admin",
          timestamp: Date.now(),
          type: "welcome",
        },
      ]);
    },
    [userInfo],
  );

  useEffect(() => {
    if (!isOpen || !userId) return;

    const unsubscribe = SupportClient.subscribeToSupportThread(userId, {
      onMessages: setMessages,
      onEmpty: async () => {
        setMessages([]);
        await injectWelcomeMessage();
      },
      onError: (error) => {
        if (import.meta.env.DEV) console.error("Chat read error:", error);
      },
    });

    return () => unsubscribe();
  }, [injectWelcomeMessage, isOpen, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || !userId) return;

    setIsLoading(true);
    const text = inputValue.trim();
    setInputValue("");

    try {
      await SupportClient.sendSupportMessage({ userId, userEmail, text });
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to send message:", error);
      setSendError(true);
      setTimeout(() => setSendError(false), 4000);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, userEmail, userId]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
      }}
    >
      {isOpen && (
        <div
          style={{
            width: "360px",
            height: "520px",
            backgroundColor: panelBg,
            borderRadius: "16px",
            boxShadow: "var(--aura-shadow, 0 8px 32px rgba(0,0,0,0.4))",
            display: "flex",
            flexDirection: "column",
            marginBottom: "16px",
            border: `1px solid ${border}`,
            overflow: "hidden",
            backdropFilter: "blur(20px)",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              backgroundColor: panelAlt,
              color: "var(--accent-text, #fff)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: `1px solid ${border}`,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "15px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                TradersApp Support
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--status-success, #22C55E)",
                  marginTop: "2px",
                }}
              >
                Online
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: textSecondary,
                fontSize: "22px",
                cursor: "pointer",
                lineHeight: "1",
                padding: "4px",
              }}
              aria-label="Close chat"
            >
              x
            </button>
          </div>

          {showPreChatForm ? (
            <div
              style={{
                flex: 1,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                background: "var(--base-layer, #f8fafc)",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <h3 style={{ color: textPrimary, marginBottom: 8 }}>
                  Before we start
                </h3>
                <p style={{ color: textSecondary, margin: 0 }}>
                  Please tell us a bit about yourself
                </p>
              </div>

              <form
                onSubmit={handleFormSubmit}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <label style={{ position: "relative" }}>
                  <User
                    style={{
                      position: "absolute",
                      left: 14,
                      top: 13,
                      color: textSecondary,
                    }}
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Your Full Name"
                    value={userInfo.name}
                    onChange={(event) =>
                      setUserInfo({ ...userInfo, name: event.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "12px 16px 12px 42px",
                      borderRadius: 14,
                      border: `1px solid ${border}`,
                      background: "var(--surface-elevated, #fff)",
                      color: "var(--text-primary, #111827)",
                    }}
                    required
                  />
                </label>

                <label style={{ position: "relative" }}>
                  <Phone
                    style={{
                      position: "absolute",
                      left: 14,
                      top: 13,
                      color: textSecondary,
                    }}
                    size={18}
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Number"
                    value={userInfo.mobile}
                    onChange={(event) =>
                      setUserInfo({ ...userInfo, mobile: event.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "12px 16px 12px 42px",
                      borderRadius: 14,
                      border: `1px solid ${border}`,
                      background: "var(--surface-elevated, #fff)",
                      color: "var(--text-primary, #111827)",
                    }}
                    required
                  />
                </label>

                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "var(--accent-primary, #2563eb)",
                    color: "var(--accent-text, #fff)",
                    border: "none",
                    borderRadius: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Start Chat
                </button>
              </form>
            </div>
          ) : (
            <>
              <div
                style={{
                  flex: 1,
                  padding: 16,
                  overflowY: "auto",
                  backgroundColor: "var(--base-layer, #f8fafc)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {messages.map((message) => {
                  const isUser = message.sender === "user" || message.isUser;
                  const isWelcome = message.type === "welcome";
                  return (
                    <div
                      key={message.id}
                      style={{
                        alignSelf: isUser ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        padding: "12px 16px",
                        borderRadius: "16px",
                        borderBottomRightRadius: isUser ? "4px" : "16px",
                        borderBottomLeftRadius: isUser ? "16px" : "4px",
                        backgroundColor: isUser
                          ? "var(--accent-primary, #2563eb)"
                          : isWelcome
                            ? "rgba(34, 197, 94, 0.15)"
                            : "var(--surface-elevated, #ffffff)",
                        color: isUser
                          ? "var(--accent-text, #fff)"
                          : isWelcome
                            ? "var(--status-success, #16a34a)"
                            : "var(--text-primary, #111827)",
                        border: isWelcome
                          ? "1px solid rgba(34, 197, 94, 0.3)"
                          : `1px solid ${border}`,
                        fontSize: "14px",
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                      }}
                    >
                      {message.text}
                    </div>
                  );
                })}

                {isLoading && (
                  <div
                    style={{
                      alignSelf: "flex-start",
                      padding: "12px 16px",
                      background: "var(--surface-elevated, #ffffff)",
                      border: `1px solid ${border}`,
                      borderRadius: 16,
                      color: textSecondary,
                      fontSize: 13,
                    }}
                  >
                    AI is thinking...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div
                style={{
                  padding: "12px 16px",
                  borderTop: `1px solid ${border}`,
                  backgroundColor: panelAlt,
                  display: "flex",
                  gap: "10px",
                }}
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: "24px",
                    border: `1px solid ${border}`,
                    backgroundColor: "var(--surface-elevated, #0f0f1a)",
                    color: textPrimary,
                    fontSize: "14px",
                  }}
                />
              <button
                onClick={sendMessage}
                disabled={isLoading}
                aria-label="Send message"
                title="Send message"
                style={{
                  backgroundColor: "var(--accent-primary, #2563eb)",
                  color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "44px",
                    height: "44px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.6 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Close support chat" : "Open support chat"}
        title={isOpen ? "Close support chat" : "Open support chat"}
        style={{
          backgroundColor: "var(--accent-primary, #2563eb)",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: "60px",
          height: "60px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(59, 130, 246, 0.4)",
          transition: "transform 0.2s, background-color 0.2s",
        }}
      >
        {isOpen ? <Send size={22} /> : <MessageBubbleIcon />}
      </button>
    </div>
  );
}

function MessageBubbleIcon() {
  return (
    <svg
      style={{ width: "28px", height: "28px" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}
