import { useEffect, useRef, useState } from "react";
import { onValue, push, ref, set } from "firebase/database";

export default function SupportChatModal({
  isOpen,
  userId,
  userName,
  onClose,
  auth,
  showToast,
  firebaseDb,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [_isTyping, setIsTyping] = useState(false);
  const [otherUserTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const canUseDb = Boolean(firebaseDb);
  const chatPath = `support_chats/${userId}`;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    return () => {
      unsubscribe();
    };
  }, [isOpen, userId, chatPath, canUseDb, firebaseDb]);

  const handleSendMessage = async () => {
    if (!input.trim() || !canUseDb) return;

    try {
      const messagesRef = ref(firebaseDb, `${chatPath}/messages`);
      const newMessageRef = push(messagesRef);
      await set(newMessageRef, {
        sender: "admin",
        senderName: auth?.displayName || "Admin",
        text: input.trim(),
        timestamp: Date.now(),
        read: false,
      });

      setInput("");
      setIsTyping(false);
    } catch {
      showToast("Failed to send message. Connection issue.", "error");
    }
  };

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
              {userName}
            </div>
            {otherUserTyping && (
              <div style={{ color: "#0A84FF", fontSize: 11, marginTop: 4 }}>
                typing...
              </div>
            )}
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
              }}
            >
              No messages yet. Start the conversation.
            </div>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.sender === "admin";
              return (
                <div
                  key={`msg_${msg.timestamp}`}
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
                        : "rgba(255,255,255,0.1)",
                      border: `1px solid ${
                        isAdmin
                          ? "rgba(0,122,255,0.5)"
                          : "rgba(255,255,255,0.2)"
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
                          color: "#A1A1A6",
                          fontSize: 10,
                          marginBottom: 4,
                        }}
                      >
                        {msg.senderName || msg.email || "User"}
                      </div>
                    )}
                    <div
                      style={{
                        color: "var(--text-primary, #F2F2F7)",
                        fontSize: 13,
                        lineHeight: 1.4,
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

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
              if (event.key === "Enter") {
                event.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type message..."
            style={{
              flex: 1,
              background: "var(--input-bg, rgba(255,255,255,0.05))",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 12px",
              color: "#F2F2F7",
              fontSize: 13,
              fontFamily: "Consolas, monospace",
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
                ? "var(--text-primary, #000)"
                : "var(--text-secondary, #A1A1A6)",
              fontSize: 13,
              fontWeight: 700,
              cursor: input.trim() ? "pointer" : "default",
              transition: "all 0.2s",
            }}
            onMouseEnter={(event) => {
              if (input.trim()) {
                event.currentTarget.style.boxShadow = "0 0 12px rgba(0,122,255,0.5)";
                event.currentTarget.style.transform = "scale(1.05)";
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.boxShadow = "none";
              event.currentTarget.style.transform = "scale(1)";
            }}
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
