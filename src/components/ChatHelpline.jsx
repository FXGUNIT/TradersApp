import React, { useState, useRef, useEffect } from "react";
import { Send, X, MessageCircle, User, Phone } from "lucide-react";

export default function ChatHelpline() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreChatForm, setShowPreChatForm] = useState(true);
  const [userInfo, setUserInfo] = useState({ name: "", mobile: "" });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiEnabled] = useState(true);

  const messagesEndRef = useRef(null);
  const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle Pre-chat Form Submission
  const handleFormSubmit = async (e) => {
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
    const welcomeMsg = {
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

    const userMessage = {
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

      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();

      // Add AI response to messages
      const aiMessage = {
        id: `ai_${Date.now()}`,
        text: data.response,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);

      const errorMessage = {
        id: `error_${Date.now()}`,
        text: "Sorry, I'm having trouble connecting. Please try again later.",
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600 transition-all duration-300"
        aria-label="Chat support"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 h-96 bg-white rounded-lg shadow-xl flex flex-col border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-blue-500 text-white p-3 flex justify-between items-center">
            <div className="font-bold">24/7 Support</div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200"
              aria-label="Close chat"
            >
              <X size={20} />
            </button>
          </div>

          {/* Pre-chat Form */}
          {showPreChatForm ? (
            <div className="flex-1 p-4 bg-gray-50">
              <h3 className="font-medium mb-3">
                Enter your details to start chatting
              </h3>
              <form onSubmit={handleFormSubmit} className="space-y-3">
                <div className="relative">
                  <User
                    className="absolute left-3 top-2.5 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    value={userInfo.name}
                    onChange={(e) =>
                      setUserInfo({ ...userInfo, name: e.target.value })
                    }
                    placeholder="Your Name"
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                    required
                  />
                </div>
                <div className="relative">
                  <Phone
                    className="absolute left-3 top-2.5 text-gray-400"
                    size={18}
                  />
                  <input
                    type="tel"
                    value={userInfo.mobile}
                    onChange={(e) =>
                      setUserInfo({ ...userInfo, mobile: e.target.value })
                    }
                    placeholder="Mobile Number"
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Start Chat
                </button>
              </form>
            </div>
          ) : (
            /* Chat Interface */
            <div className="flex-1 flex flex-col bg-gray-50">
              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-3 ${msg.isUser ? "text-right" : "text-left"}`}
                  >
                    <div
                      className={`inline-block p-3 rounded-lg max-w-[80%] ${msg.isUser ? "bg-blue-100" : "bg-white border"}`}
                    >
                      {msg.text}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 border-t bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
                    disabled={isLoading || !input.trim()}
                    aria-label="Send message"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
