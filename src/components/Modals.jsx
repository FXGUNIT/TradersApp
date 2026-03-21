import { useState, useRef, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { T, ACCENT_COLORS } from '../constants/theme.js';
import firebaseOptimizer from '../services/firebaseOptimization.js';

// Real-time Direct Support Chat Modal (RULE #209: Typing Indicator)
export function SupportChatModal({ isOpen, userId, userName, onClose, auth, showToast, firebaseDb }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [_isTyping, _setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  // Firebase path for chat
  const chatPath = `support_chats/${[auth?.uid, userId].sort().join('_')}`;
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Set up real-time message listener
  useEffect(() => {
    if (!isOpen || !userId) return;
    
    // Optimized chat listener with connection pooling & caching
    const unsubscribe = firebaseOptimizer.createOptimizedListener(
      chatPath,
      (result) => {
        const data = result.isBatched ? result.updates[result.updates.length - 1] : result;
        if (data) {
          const msgs = Object.entries(data)
            .filter(([key]) => !key.startsWith('typing_'))
            .map(([, msg]) => msg)
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          setMessages(msgs);
        }
      },
      firebaseDb, ref, onValue
    );
    
    // Optimized typing indicator listener
    const typingUnsub = firebaseOptimizer.createOptimizedListener(
      `${chatPath}/typing_${userId}`,
      (result) => {
        const data = result.isBatched ? result.updates[result.updates.length - 1] : result;
        setOtherUserTyping(data === true);
      },
      firebaseDb, ref, onValue
    );
    
    return () => {
      unsubscribe();
      typingUnsub();
    };
  }, [isOpen, userId, chatPath]);
  
  // Send message handler
  const handleSendMessage = async () => {
    if (!input.trim() || !auth?.uid) return;
    
    try {
      const msgRef = ref(firebaseDb, `${chatPath}/msg_${Date.now()}`);
      await set(msgRef, {
        sender: auth.uid,
        senderName: auth.displayName || 'Admin',
        text: input.trim(),
        timestamp: Date.now(),
        read: false
      });
      
      // Clear typing indicator
      await set(ref(firebaseDb, `${chatPath}/typing_${auth.uid}`), null);
      setInput('');
      _setIsTyping(false);
    } catch {
      showToast('Failed to send message. Connection issue.', 'error');
    }
  };
  
  // Typing indicator handler
  const handleTyping = (text) => {
    setInput(text);
    
    if (!auth?.uid) return;
    
    clearTimeout(typingTimeoutRef.current);
    _setIsTyping(true);
    set(ref(firebaseDb, `${chatPath}/typing_${auth.uid}`), true);
    
    typingTimeoutRef.current = setTimeout(() => {
      set(ref(firebaseDb, `${chatPath}/typing_${auth.uid}`), null);
      _setIsTyping(false);
    }, 3000);
  };
  
  if (!isOpen) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10001
    }}>
      <div style={{
        background: 'rgba(20,20,25,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        width: '90%',
        maxWidth: 500,
        height: 600,
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(30px)'
      }} className="restored-modal">
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ color: '#F2F2F7', fontSize: 14, fontWeight: 600 }}>
              {userName}
            </div>
            {otherUserTyping && (
              <div style={{ color: '#0A84FF', fontSize: 11, marginTop: 4 }}>
                {"\u270E"} typing...
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#A1A1A6',
              fontSize: 24,
              cursor: 'pointer'
            }}
          >
            {"\u2715"}
          </button>
        </div>
        
        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {messages.length === 0 ? (
            <div style={{ color: '#A1A1A6', textAlign: 'center', marginTop: 20 }}>
              No messages yet. Start the conversation.
            </div>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.sender === auth?.uid;
              return (
                <div
                  key={`msg_${msg.timestamp}`}
                  style={{
                    display: 'flex',
                    justifyContent: isAdmin ? 'flex-end' : 'flex-start',
                    marginBottom: 8
                  }}
                >
                  <div
                    style={{
                      background: isAdmin ? 'rgba(0,122,255,0.3)' : 'rgba(255,255,255,0.1)',
                      border: `1px solid ${isAdmin ? 'rgba(0,122,255,0.5)' : 'rgba(255,255,255,0.2)'}`,
                      borderRadius: 12,
                      padding: '10px 14px',
                      maxWidth: '80%',
                      wordWrap: 'break-word'
                    }}
                  >
                    {!isAdmin && (
                      <div style={{ color: '#A1A1A6', fontSize: 10, marginBottom: 4 }}>
                        {msg.senderName}
                      </div>
                    )}
                    <div style={{ color: '#F2F2F7', fontSize: 13, lineHeight: 1.4 }}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Message Input */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          gap: 12
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type message..."
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '10px 12px',
              color: '#F2F2F7',
              fontSize: 13,
              fontFamily: 'Consolas, monospace'
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim()}
            style={{
              background: input.trim() ? '#0A84FF' : 'rgba(0,122,255,0.3)',
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              color: input.trim() ? '#000' : '#A1A1A6',
              fontSize: 13,
              fontWeight: 700,
              cursor: input.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (input.trim()) {
                e.currentTarget.style.boxShadow = '0 0 12px rgba(0,122,255,0.5)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}

// RULE #295, #296: MAINTENANCE MODE - 'BACK SOON' SCREEN
export function MaintenanceScreen() {
  const [timeLeft, setTimeLeft] = useState('');
  
  // Simulate countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const nextMaintenance = new Date(now.getTime() + Math.random() * 4 * 60 * 60 * 1000); // Random 1-4 hours
      
      const updateCountdown = () => {
        const diff = nextMaintenance - new Date();
        if (diff <= 0) {
          setTimeLeft('Returning now...');
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeLeft(`${hours}h ${minutes}m`);
        }
      };
      
      updateCountdown();
      const interval = setInterval(updateCountdown, 30000); // Update every 30s
      return () => clearInterval(interval);
    };
    
    updateTimer();
  }, []);
  
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F9FAFB',
      backdropFilter: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: '20px',
      fontFamily: 'Consolas, monospace'
    }}>
      {/* Animated Background Gradient */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `radial-gradient(circle at 20% 50%, rgba(0,122,255,0.05) 0%, transparent 50%),
                     radial-gradient(circle at 80% 80%, rgba(48,209,88,0.05) 0%, transparent 50%)`,
        animation: 'fadeInDashboard 4s ease-in-out infinite',
        pointerEvents: 'none'
      }} />
      
      {/* Main Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        {/* Status Icon */}
        <div style={{
          fontSize: '80px',
          marginBottom: '24px',
          animation: 'float 3s ease-in-out infinite'
        }}>
          {"\uD83D\uDD27"}
        </div>
        
        {/* Heading */}
        <h1 style={{
          color: '#F2F2F7',
          fontSize: '48px',
          fontWeight: 800,
          marginBottom: '16px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          background: 'linear-gradient(135deg, #0A84FF 0%, #30D158 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          BACK SOON
        </h1>
        
        {/* Subheading */}
        <div style={{
          color: '#A1A1A6',
          fontSize: '16px',
          fontWeight: 600,
          marginBottom: '32px',
          letterSpacing: '1px',
          lineHeight: '1.6'
        }}>
          We're performing scheduled maintenance to enhance your trading experience.
          <br />
          System integrity checks in progress.
        </div>
        
        {/* Status Box */}
        <div style={{
          background: 'rgba(0,122,255,0.1)',
          border: '1px solid rgba(0,122,255,0.3)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            color: '#A1A1A6',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '12px',
            letterSpacing: '1px'
          }}>
            ESTIMATED DOWNTIME
          </div>
          <div style={{
            color: '#0A84FF',
            fontSize: '28px',
            fontWeight: 800,
            fontFamily: 'Consolas, monospace',
            letterSpacing: '2px'
          }}>
            {timeLeft || 'Loading...'}
          </div>
        </div>
        
        {/* Features List */}
        <div style={{
          textAlign: 'left',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '32px'
        }}>
          <div style={{
            color: '#F2F2F7',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '16px',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>
            SYSTEM UPGRADES IN PROGRESS
          </div>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {['Optimizing database queries', 'Enhancing security protocols', 'Improving performance metrics'].map((item, i) => (
              <li key={i} style={{
                color: '#A1A1A6',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{
                  color: '#30D158',
                  fontWeight: 800
                }}>{"\u2713"}</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        
        {/* Footer Message */}
        <div style={{
          color: '#5A5A5F',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.5px'
        }}>
          Thank you for your patience. We're back to full capacity shortly.
          <br />
          <span style={{ marginTop: '8px', display: 'block' }}>
            Need immediate support? <span style={{ color: '#0A84FF' }}>contact@tradersapp.io</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// RULE #181-185, #193, #208: Advanced Notification Engine with Toast Stacking & Swipe-to-Dismiss
export function Toast({ toasts, onDismiss }) {
  const [swipedToast, setSwipedToast] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  
  const getToastColor = (type) => {
    const colors = {
      success: { border: '#30D158', bg: 'rgba(48, 209, 88, 0.1)', text: '#30D158', icon: '\u2713' },
      error: { border: '#FF453A', bg: 'rgba(255, 69, 58, 0.1)', text: '#FF453A', icon: '\u2715' },
      warning: { border: '#FFD60A', bg: 'rgba(255, 214, 10, 0.1)', text: '#FFD60A', icon: '\u26A0' },
      info: { border: '#0A84FF', bg: 'rgba(10, 132, 255, 0.1)', text: '#0A84FF', icon: '\u2139' },
      critical: { border: '#FF3B30', bg: 'rgba(255, 59, 48, 0.15)', text: '#FF3B30', icon: '\uD83D\uDEA8' },
    };
    return colors[type] || colors.info;
  };
  
  // RULE #181: Handle swipe-to-dismiss on touch devices
  const handleTouchStart = (e, toastId) => {
    setTouchStart({ x: e.touches[0].clientX, id: toastId });
  };
  
  const handleTouchMove = (e, toastId) => {
    if (!touchStart || touchStart.id !== toastId) return;
    
    const currentX = e.touches[0].clientX;
    const diffX = currentX - touchStart.x;
    
    // Swipe right to dismiss (>50px threshold)
    if (diffX > 50) {
      setSwipedToast(toastId);
    }
  };
  
  const handleTouchEnd = (toastId) => {
    if (swipedToast === toastId) {
      onDismiss(toastId);
      setSwipedToast(null);
    }
    setTouchStart(null);
  };
  
  const isMobile = window.innerWidth < 768;
  
  return (
    <div style={{
      position: "fixed",
      top: 20,
      right: isMobile ? 12 : 20,
      left: isMobile ? 12 : 'auto',
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      pointerEvents: 'none',
      maxWidth: isMobile ? 'calc(100% - 24px)' : 420
    }}>
      {toasts.map((toast) => {
        const color = getToastColor(toast.type);
        const isBeingSwiped = swipedToast === toast.id;
        
        return (
          <div
            key={toast.id}
            onTouchStart={(e) => handleTouchStart(e, toast.id)}
            onTouchMove={(e) => handleTouchMove(e, toast.id)}
            onTouchEnd={() => handleTouchEnd(toast.id)}
            style={{
              background: color.bg,
              border: `1px solid rgba(${color.border.replace('#', '')}, 0.3)`.match(/#/) ? 
                `1px solid ${color.border}30` : 
                `1px solid rgba(10,132,255,0.3)`,
              borderLeft: `4px solid ${color.border}`,
              borderRadius: 8,
              padding: "14px 16px ",
              backdropFilter: "blur(20px)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: T.font,
              fontSize: 13,
              color: color.text,
              fontWeight: 600,
              animation: `slideInToast-gpu 0.3s ease-out`,
              boxShadow: `0 0 20px rgba(0,0,0,0.4)`,
              pointerEvents: 'auto',
              cursor: isMobile ? 'grab' : 'default',
              userSelect: 'none',
              transform: isBeingSwiped ? 'translateX(100%)' : 'translateX(0)',
              opacity: isBeingSwiped ? 0.5 : 1,
              transition: isBeingSwiped ? 'none' : 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
              minWidth: isMobile ? '100%' : 320,
              maxWidth: isMobile ? '100%' : 400
            }}
          >
            {/* Progress bar for auto-dismiss */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: '3px',
              background: color.border,
              width: `${((toast.time_remaining || toast.duration || 3000) / (toast.duration || 3000)) * 100}%`,
              animation: `${toast.duration || 3000}ms linear backwards`,
              borderRadius: '0 0 0 8px'
            }} />
            
            <span style={{ fontSize: 18, fontWeight: 700, flexShrink: 0 }}>{color.icon}</span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
            
            {/* Close button */}
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: color.text,
                fontSize: 18,
                cursor: 'pointer',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: 0.6,
                transition: 'opacity 0.2s',
                marginLeft: '8px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
            >
              {"\u2715"}
            </button>
            
            {/* Mobile swipe hint */}
            {isMobile && toasts.length > 1 && (
              <div style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: color.border,
                opacity: 0.4
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  THEME PICKER COMPONENT — GLASSMORPHIC ACCENT COLOR SELECTOR
// ═══════════════════════════════════════════════════════════════════
export function ThemePicker({ isOpen, onClose, onSelectTheme, currentTheme }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: '16px',
        backdropFilter: 'blur(20px)',
        padding: '24px',
        minWidth: '380px',
        fontFamily: T.font
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: T.text, margin: 0, fontSize: '18px', fontWeight: 600 }}>Theme Picker</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: T.muted,
              fontSize: '24px',
              cursor: 'pointer',
              padding: 0
            }}
          >
            {"\u2715"}
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {Object.entries(ACCENT_COLORS).map(([key, color]) => (
            <button
              key={key}
              onClick={() => onSelectTheme(key)}
              style={{
                background: currentTheme === key ? color.light : 'rgba(255,255,255,0.05)',
                border: `2px solid ${currentTheme === key ? color.primary : T.border}`,
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease',
                boxShadow: currentTheme === key ? `0 0 12px ${color.glow}` : 'none',
                fontFamily: T.font
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = `0 0 12px ${color.glow}`;
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = currentTheme === key ? 'scale(1)' : 'scale(1)';
                e.target.style.boxShadow = currentTheme === key ? `0 0 12px ${color.glow}` : 'none';
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: color.primary,
                boxShadow: `0 0 12px ${color.glow}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {currentTheme === key && <span style={{ color: T.bg, fontSize: '16px' }}>{"\u2713"}</span>}
              </div>
              <span style={{ color: T.text, fontSize: '13px', fontWeight: 500 }}>{color.name}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '12px',
            background: `${ACCENT_COLORS[currentTheme]?.primary || ACCENT_COLORS.BLUE.primary}22`,
            border: `1px solid ${ACCENT_COLORS[currentTheme]?.primary || ACCENT_COLORS.BLUE.primary}`,
            borderRadius: '8px',
            color: ACCENT_COLORS[currentTheme]?.primary || ACCENT_COLORS.BLUE.primary,
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: T.font,
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            const accentHex = ACCENT_COLORS[currentTheme]?.primary || ACCENT_COLORS.BLUE.primary;
            e.target.style.background = `${accentHex}33`;
            e.target.style.boxShadow = `0 0 8px ${ACCENT_COLORS[currentTheme]?.glow || ACCENT_COLORS.BLUE.glow}`;
          }}
          onMouseLeave={(e) => {
            const accentHex = ACCENT_COLORS[currentTheme]?.primary || ACCENT_COLORS.BLUE.primary;
            e.target.style.background = `${accentHex}22`;
            e.target.style.boxShadow = 'none';
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
