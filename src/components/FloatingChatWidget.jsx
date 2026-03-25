import React, { useState, useCallback, useEffect, useRef } from "react";
import { ref, onValue, push, set } from "firebase/database";
import { notifyAdminOfSupportRequest } from "../services/telegramService";
import { db } from "../services/firebase";

const FloatingChatWidget = ({ auth, profile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreChatForm, setShowPreChatForm] = useState(true);
  const [userInfo, setUserInfo] = useState({ name: "", mobile: "" });
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const aiEnabled = true;
  const messagesEndRef = useRef(null);

  const userId = auth?.uid || profile?.uid || "anonymous";
  const userEmail = profile?.email || auth?.email || "Unknown";

  const injectWelcomeMessage = useCallback(async () => {
    if (isInitialized || !userId) return;
    setIsInitialized(true);

    const welcomeRef = ref(db, `support_chats/${userId}/messages`);
    await push(welcomeRef, {
      text: `👋 Welcome to TradersApp Support! Your account: ${userEmail}\n\nHow can we help you today?`,
      sender: "admin",
      timestamp: Date.now(),
      type: "welcome",
    });
  }, [userId, userEmail, isInitialized]);

  // Handle Pre-chat Form Submission
  const handleFormSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!userInfo.name.trim() || !userInfo.mobile.trim()) return;

      setShowPreChatForm(false);

      // Notify n8n that a new chat has started (if webhook available)
      const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;
      if (N8N_WEBHOOK_URL) {
        try {
          await fetch(`${N8N_WEBHOOK_URL}/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: userInfo.name.trim(),
              mobile: userInfo.mobile.trim(),
              pageUrl: window.location.href,
              startedAt: new Date().toISOString(),
            }),
          });
        } catch (error) {
          console.error("Failed to notify n8n on chat start:", error);
        }
      }

      // Welcome message
      const welcomeMsg = {
        id: "welcome",
        text: `Hi ${userInfo.name}! I'm your 24×7 AI assistant. How can I help you today?`,
        isUser: false,
        timestamp: Date.now(),
      };
      setMessages([welcomeMsg]);
    },
    [userInfo],
  );

  useEffect(() => {
    if (!isOpen || !userId) return;

    const chatRef = ref(db, `support_chats/${userId}`);

    const unsubscribe = onValue(
      chatRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data && data.messages) {
          const msgArray = Object.entries(data.messages).map(([key, val]) => ({
            id: key,
            ...val,
          }));
          setMessages(msgArray);
        } else if (data === null) {
          setMessages([]);
          injectWelcomeMessage();
        }
      },
      (error) => {
        console.error("Chat read error:", error);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen, userId, injectWelcomeMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    console.warn("sendMessage called with:", { inputValue, userId, userEmail });
    if (!inputValue.trim() || !userId) {
      console.warn("sendMessage aborted: missing input or userId", {
        inputValue,
        userId,
      });
      return;
    }

    setIsLoading(true);
    const text = inputValue.trim();
    setInputValue("");

    try {
      console.warn("Attempting to save message to Firebase:", { userId, text });
      const messagesRef = ref(db, `support_chats/${userId}/messages`);
      const newMessageRef = push(messagesRef);

      await set(newMessageRef, {
        text,
        sender: "user",
        timestamp: Date.now(),
        email: userEmail,
      });
      console.warn("Message saved to Firebase successfully");

      // Send Telegram notification using the telegram service
      console.warn("Attempting to send Telegram notification:", {
        userEmail,
        text,
      });
      await notifyAdminOfSupportRequest(userEmail, text).catch((error) => {
        console.warn("Telegram notification failed:", error);
        // Don't fail the entire message send if Telegram notification fails
      });
      console.warn("Telegram notification process completed");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, userId, userEmail]);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const styles = {
    widgetContainer: {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
    },
    chatWindow: {
      width: "360px",
      height: "520px",
      backgroundColor: "var(--aura-surface-elevated, #1a1a2e)",
      borderRadius: "16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      display: "flex",
      flexDirection: "column",
      marginBottom: "16px",
      border:
        "1px solid rgba(var(--aura-text-primary-rgb, 255, 255, 255), 0.1)",
      overflow: "hidden",
    },
    chatHeader: {
      padding: "16px 20px",
      backgroundColor: "var(--aura-surface-primary, #16213e)",
      color: "var(--aura-text-primary, #fff)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom:
        "1px solid rgba(var(--aura-text-primary-rgb, 255, 255, 255), 0.1)",
    },
    headerText: {
      fontWeight: 700,
      fontSize: "15px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    headerSubtext: {
      fontSize: "11px",
      color: "var(--aura-accent-success, #4ade80)",
      marginTop: "2px",
    },
    closeButton: {
      background: "none",
      border: "none",
      color: "rgba(var(--aura-text-primary-rgb, 255, 255, 255), 0.7)",
      fontSize: "28px",
      cursor: "pointer",
      lineHeight: "1",
      padding: "4px",
    },
    chatBody: {
      flex: 1,
      padding: "16px",
      overflowY: "auto",
      backgroundColor: "var(--aura-surface-elevated, #1a1a2e)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
    messageBubble: {
      maxWidth: "85%",
      padding: "12px 16px",
      borderRadius: "16px",
      fontSize: "14px",
      lineHeight: "1.5",
      fontFamily: "system-ui, -apple-system, sans-serif",
      wordBreak: "break-word",
    },
    userMessage: {
      alignSelf: "flex-end",
      backgroundColor: "var(--aura-accent-primary, #3b82f6)",
      color: "var(--aura-text-primary, #fff)",
      borderBottomRightRadius: "4px",
    },
    adminMessage: {
      alignSelf: "flex-start",
      backgroundColor: "var(--aura-surface-secondary, #2d2d44)",
      color: "var(--aura-text-secondary, #e2e8f0)",
      borderBottomLeftRadius: "4px",
    },
    welcomeMessage: {
      alignSelf: "flex-start",
      backgroundColor:
        "rgba(var(--aura-accent-success-rgb, 34, 197, 94), 0.15)",
      color: "var(--aura-accent-success, #4ade80)",
      border:
        "1px solid rgba(var(--aura-accent-success-rgb, 34, 197, 94), 0.3)",
      borderBottomLeftRadius: "4px",
    },
    chatFooter: {
      padding: "12px 16px",
      borderTop:
        "1px solid rgba(var(--aura-text-primary-rgb, 255, 255, 255), 0.1)",
      backgroundColor: "var(--aura-surface-primary, #16213e)",
      display: "flex",
      gap: "10px",
    },
    input: {
      flex: 1,
      padding: "12px 16px",
      borderRadius: "24px",
      border:
        "1px solid rgba(var(--aura-text-primary-rgb, 255, 255, 255), 0.2)",
      backgroundColor: "var(--aura-base-layer, #0f0f1a)",
      color: "var(--aura-text-primary, #fff)",
      fontSize: "14px",
      outline: "none",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    sendButton: {
      backgroundColor: "var(--aura-accent-primary, #3b82f6)",
      color: "var(--aura-text-primary, white)",
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
    },
    chatButton: {
      backgroundColor: "var(--aura-accent-primary, #3b82f6)",
      color: "var(--aura-text-primary, white)",
      border: "none",
      borderRadius: "50%",
      width: "60px",
      height: "60px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      cursor: "pointer",
      boxShadow:
        "0 4px 16px rgba(var(--aura-accent-primary-rgb, 59, 130, 246), 0.4)",
      transition: "transform 0.2s, background-color 0.2s",
    },
    icon: {
      width: "28px",
      height: "28px",
    },
    timestamp: {
      fontSize: "10px",
      color: "rgba(var(--aura-text-primary-rgb, 255, 255, 255), 0.4)",
      marginTop: "4px",
      textAlign: "right",
    },
    emptyState: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "rgba(var(--aura-text-primary-rgb, 255, 255, 255), 0.5)",
      fontSize: "14px",
      textAlign: "center",
      padding: "20px",
    },
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getMessageStyle = (msg) => {
    if (msg.type === "welcome")
      return { ...styles.messageBubble, ...styles.welcomeMessage };
    return msg.sender === "user"
      ? { ...styles.messageBubble, ...styles.userMessage }
      : { ...styles.messageBubble, ...styles.adminMessage };
  };

  const SendIcon = () => (
    <svg
      style={{ width: "20px", height: "20px" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  );

  const ChatIcon = () => (
    <svg
      style={styles.icon}
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

  const CloseIcon = () => (
    <svg
      style={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );

  return (
    <div style={styles.widgetContainer}>
      {isOpen && (
        <div style={styles.chatWindow}>
          <div style={styles.chatHeader}>
            <div>
              <div style={styles.headerText}>💬 TradersApp Support</div>
              <div style={styles.headerSubtext}>● Online</div>
            </div>
            <button
              onClick={toggleChat}
              style={styles.closeButton}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
          {showPreChatForm && (
            <div className="flex-1 p-6 flex flex-col justify-center bg-gray-50 dark:bg-gray-950">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2">Before we start</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Please tell us a bit about yourself
                </p>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="relative">
                  <User
                    className="absolute left-4 top-3.5 text-gray-400"
                    size={20}
                  />
                  <input
                    type="text"
                    placeholder="Your Full Name"
                    value={userInfo.name}
                    onChange={(e) =>
                      setUserInfo({ ...userInfo, name: e.target.value })
                    }
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="relative">
                  <Phone
                    className="absolute left-4 top-3.5 text-gray-400"
                    size={20}
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Number"
                    value={userInfo.mobile}
                    onChange={(e) =>
                      setUserInfo({ ...userInfo, mobile: e.target.value })
                    }
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-2xl transition-colors"
                >
                  Start Chat
                </button>
              </form>
            </div>
          )}
          {!showPreChatForm && (
            <>
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-950 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${
                        msg.isUser
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-bl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-none text-sm flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      AI is thinking...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={
                      aiEnabled
                        ? "Type your message..."
                        : "AI is off. You can reply manually in Telegram"
                    }
                    className="flex-1 px-5 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:border-blue-500 disabled:opacity-60"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !inputValue.trim()}
                    className="w-12 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <Send size={20} />
                  </button>
                </div>
                <p className="text-[10px] text-center text-gray-500 mt-2">
                  Messages are monitored • AI learns from conversations
                </p>
              </div>
            </>
          )}
        </div>
      )}
      <button
        style={{
          ...styles.chatButton,
          backgroundColor: isOpen ? "#ef4444" : "#3b82f6",
        }}
        onClick={toggleChat}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>
    </div>
  );
};

export default FloatingChatWidget;
