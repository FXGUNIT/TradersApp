import React, { useState, useCallback, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, push, set, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBPN7fIZ-UfVQ5EMti1TzrFPsi4wtUEtKI",
  authDomain: "traders-regiment.firebaseapp.com",
  projectId: "traders-regiment",
  storageBucket: "traders-regiment.appspot.com",
  messagingSenderId: "1074706591741",
  appId: "1:1074706591741:web:53194a737f7d3d3d3d3d3d",
  databaseURL: "https://traders-regiment-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const FloatingChatWidget = ({ auth, profile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef(null);

  const userId = auth?.uid || profile?.uid || 'anonymous';
  const userEmail = profile?.email || auth?.email || 'Unknown';

  useEffect(() => {
    if (!isOpen || !userId || isInitialized) return;

    const chatRef = ref(db, `support_chats/${userId}`);

    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.messages) {
        const msgArray = Object.entries(data.messages).map(([key, val]) => ({
          id: key,
          ...val
        }));
        setMessages(msgArray);
      } else if (data === null) {
        setMessages([]);
        injectWelcomeMessage();
      }
    }, (error) => {
      console.error('Chat read error:', error);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const injectWelcomeMessage = useCallback(async () => {
    if (isInitialized || !userId) return;
    setIsInitialized(true);

    const welcomeRef = ref(db, `support_chats/${userId}/messages`);
    await push(welcomeRef, {
      text: `👋 Welcome to TradersApp Support! Your account: ${userEmail}\n\nHow can we help you today?`,
      sender: 'admin',
      timestamp: Date.now(),
      type: 'welcome'
    });
  }, [userId, userEmail, isInitialized]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || !userId) return;

    setIsLoading(true);
    const text = inputValue.trim();
    setInputValue('');

    try {
      const messagesRef = ref(db, `support_chats/${userId}/messages`);
      const newMessageRef = push(messagesRef);

      await set(newMessageRef, {
        text,
        sender: 'user',
        timestamp: Date.now(),
        email: userEmail
      });

      await fetch('/.netlify/functions/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'support_message',
          userId,
          userEmail,
          message: text
        })
      }).catch(() => {});

    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, userId, userEmail]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const styles = {
    widgetContainer: {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
    },
    chatWindow: {
      width: '360px',
      height: '520px',
      backgroundColor: '#1a1a2e',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex',
      flexDirection: 'column',
      marginBottom: '16px',
      border: '1px solid rgba(255,255,255,0.1)',
      overflow: 'hidden',
    },
    chatHeader: {
      padding: '16px 20px',
      backgroundColor: '#16213e',
      color: '#fff',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    },
    headerText: {
      fontWeight: 700,
      fontSize: '15px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    headerSubtext: {
      fontSize: '11px',
      color: '#4ade80',
      marginTop: '2px',
    },
    closeButton: {
      background: 'none',
      border: 'none',
      color: 'rgba(255,255,255,0.7)',
      fontSize: '28px',
      cursor: 'pointer',
      lineHeight: '1',
      padding: '4px',
    },
    chatBody: {
      flex: 1,
      padding: '16px',
      overflowY: 'auto',
      backgroundColor: '#1a1a2e',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    messageBubble: {
      maxWidth: '85%',
      padding: '12px 16px',
      borderRadius: '16px',
      fontSize: '14px',
      lineHeight: '1.5',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      wordBreak: 'break-word',
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: '#3b82f6',
      color: '#fff',
      borderBottomRightRadius: '4px',
    },
    adminMessage: {
      alignSelf: 'flex-start',
      backgroundColor: '#2d2d44',
      color: '#e2e8f0',
      borderBottomLeftRadius: '4px',
    },
    welcomeMessage: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      color: '#4ade80',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      borderBottomLeftRadius: '4px',
    },
    chatFooter: {
      padding: '12px 16px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      backgroundColor: '#16213e',
      display: 'flex',
      gap: '10px',
    },
    input: {
      flex: 1,
      padding: '12px 16px',
      borderRadius: '24px',
      border: '1px solid rgba(255,255,255,0.2)',
      backgroundColor: '#0f0f1a',
      color: '#fff',
      fontSize: '14px',
      outline: 'none',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    sendButton: {
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '44px',
      height: '44px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      cursor: isLoading ? 'not-allowed' : 'pointer',
      opacity: isLoading ? 0.6 : 1,
      transition: 'all 0.2s ease',
    },
    chatButton: {
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '60px',
      height: '60px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
      transition: 'transform 0.2s, background-color 0.2s',
    },
    icon: {
      width: '28px',
      height: '28px',
    },
    timestamp: {
      fontSize: '10px',
      color: 'rgba(255,255,255,0.4)',
      marginTop: '4px',
      textAlign: 'right',
    },
    emptyState: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'rgba(255,255,255,0.5)',
      fontSize: '14px',
      textAlign: 'center',
      padding: '20px',
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageStyle = (msg) => {
    if (msg.type === 'welcome') return { ...styles.messageBubble, ...styles.welcomeMessage };
    return msg.sender === 'user'
      ? { ...styles.messageBubble, ...styles.userMessage }
      : { ...styles.messageBubble, ...styles.adminMessage };
  };

  const SendIcon = () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  );

  const ChatIcon = () => (
    <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );

  const CloseIcon = () => (
    <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <button onClick={toggleChat} style={styles.closeButton} aria-label="Close chat">
              ✕
            </button>
          </div>
          <div style={styles.chatBody}>
            {messages.length === 0 ? (
              <div style={styles.emptyState}>
                Start a conversation...
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} style={getMessageStyle(msg)}>
                  {msg.text}
                  {msg.timestamp && (
                    <div style={styles.timestamp}>{formatTime(msg.timestamp)}</div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={styles.chatFooter}>
            <input
              type="text"
              placeholder="Type a message..."
              style={styles.input}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button
              style={styles.sendButton}
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
      <button
        style={{...styles.chatButton, backgroundColor: isOpen ? '#ef4444' : '#3b82f6'}}
        onClick={toggleChat}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>
    </div>
  );
};

export default FloatingChatWidget;