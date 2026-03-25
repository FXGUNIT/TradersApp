import React, { useState, useRef, useEffect } from "react";
import { Send, X, MessageCircle, User, Phone } from "lucide-react";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface UserInfo {
  name: string;
  mobile: string;
}

export default function ChatHelpline() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreChatForm, setShowPreChatForm] = useState(true);
  const [userInfo, setUserInfo] = useState<UserInfo>({ name: "", mobile: "" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true); // Local state for UI feedback

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle Pre-chat Form Submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInfo.name.trim() || !userInfo.mobile.trim()) return;

    setShowPreChatForm(false);

    // Notify n8n that a new chat has started
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

    // Welcome message
    const welcomeMsg: Message = {
      id: "welcome",
      text: `Hi ${userInfo.name}! I'm your 24×7 AI assistant. How can I help you today?`,
      isUser: false,
      timestamp: new Date(),
    };
    setMessages([welcomeMsg]);
  };

  // Send Message to n8n
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          name: userInfo.name,
          mobile: userInfo.mobile,
          message: currentInput,
          chatId: `chat_${userInfo.mobile}_${Date.now()}`,
          aiEnabled: aiEnabled,
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      // Add AI reply (if any)
      if (data.reply) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.reply,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      }

      // If AI was turned off by you, show system message
      if (data.aiStatus === "off") {
        setAiEnabled(false);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Close chat
  const closeChat = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-2xl flex items-center justify-center z-50 transition-all duration-300 hover:scale-110"
        aria-label="24x7 Chat Help"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[380px] h-[520px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-50">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                🤖
              </div>
              <div>
                <p className="font-semibold text-lg">24×7 Chat Help</p>
                <p className="text-xs opacity-90 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  AI + Human Support
                </p>
              </div>
            </div>
            <button
              onClick={closeChat}
              className="hover:bg-white/20 p-1.5 rounded-xl transition-colors"
            >
              <X size={22} />
            </button>
          </div>

          {/* Pre-Chat Form */}
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

          {/* Chat Messages Area */}
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
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
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
                    disabled={isLoading || !input.trim()}
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
    </>
  );
}
