/**
 * ═══════════════════════════════════════════════════════════════════
 * ADMIN MESSAGE PANEL - Support Chat Dashboard
 * ═══════════════════════════════════════════════════════════════════
 *
 * Features:
 * - Lists all support conversations sorted by last message time
 * - Shows unread count badges
 * - Displays user email + name in chat list
 * - Real-time message polling (3s interval) for admin dashboard
 * - Admin reply → saves to Firestore + notifies user via Telegram
 * - Marks user messages as read when admin opens a chat
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
<<<<<<< HEAD
import { resolveBffBaseUrl } from '../services/runtimeConfig.js';

const BFF_BASE = resolveBffBaseUrl();
const POLL_INTERVAL_MS = 5_000;
const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return d.toLocaleDateString();
}

function ChatListItem({ chat, isSelected, onClick }) {
  const lastMsg = chat.lastMessage || {};
  const hasUnread = chat.unreadCount > 0;

=======

const BFF_BASE = import.meta.env.VITE_BFF_URL || '';
const POLL_INTERVAL_MS = 5_000;

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return d.toLocaleDateString();
}

function ChatListItem({ chat, isSelected, onClick }) {
  const lastMsg = chat.lastMessage || {};
  const hasUnread = chat.unreadCount > 0;

>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: isSelected ? 'rgba(10,132,255,0.15)' : 'transparent',
        borderLeft: isSelected ? '3px solid #0A84FF' : '3px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12,
            fontWeight: hasUnread ? 700 : 600,
            color: hasUnread ? '#0A84FF' : '#F2F2F7',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {chat.uid || 'Unknown User'}
          </div>
          <div style={{
            fontSize: 10,
            color: '#636366',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}>
            {lastMsg.text || 'No messages'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {hasUnread && (
            <span style={{
              background: '#FF3B30',
              color: '#fff',
              borderRadius: 10,
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 5px',
              minWidth: 16,
              textAlign: 'center',
            }}>
              {chat.unreadCount}
            </span>
          )}
          <span style={{ fontSize: 9, color: '#636366' }}>
            {formatTime(lastMsg.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.sender === 'user';
  const isAdmin = msg.sender === 'admin';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isAdmin ? 'flex-end' : 'flex-start',
      marginBottom: 8,
    }}>
      <div style={{
        maxWidth: '75%',
        borderRadius: 14,
        padding: '8px 12px',
        background: isAdmin
          ? 'rgba(0,122,255,0.3)'
          : 'rgba(255,255,255,0.08)',
        border: `1px solid ${
          isAdmin ? 'rgba(0,122,255,0.4)' : 'rgba(255,255,255,0.12)'
        }`,
      }}>
        {(isUser || !isAdmin) && (
          <div style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: '#636366',
            marginBottom: 3,
          }}>
            {msg.senderName || msg.senderEmail || 'User'}
            {msg.fromTelegram && (
              <span style={{ color: '#30D158', marginLeft: 4, fontSize: 9 }}>
                via Telegram
              </span>
            )}
          </div>
        )}
        {isAdmin && (
          <div style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: '#0A84FF',
            marginBottom: 3,
          }}>
            {msg.senderName || 'Support Team'}
          </div>
        )}
        <div style={{
          fontSize: 12.5,
          color: '#F2F2F7',
          lineHeight: 1.5,
          wordBreak: 'break-word',
        }}>
          {msg.text}
        </div>
        <div style={{
          fontSize: 8.5,
          color: '#636366',
          marginTop: 4,
          textAlign: isAdmin ? 'right' : 'left',
        }}>
          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit',
          }) : ''}
          {' '}{msg.read && isAdmin ? '✓✓' : msg.read ? '✓' : ''}
        </div>
      </div>
    </div>
  );
}

export default function AdminMessagePanel({ adminName = 'Admin' }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
<<<<<<< HEAD
  const [_error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const intervalRef = useRef(null);

=======
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const intervalRef = useRef(null);

  const headers = {
    'Content-Type': 'application/json',
  };

>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
  // ── Fetch all chats ───────────────────────────────────────────────
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch(`${BFF_BASE}/support/threads`, {
<<<<<<< HEAD
        headers: JSON_HEADERS,
=======
        headers,
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        // Transform BFF thread format to admin panel format
        const threads = Array.isArray(data.threads)
          ? data.threads.map(t => ({
              uid: t.uid,
              unreadCount: (t.messages || []).filter(m => m.sender === 'user' && !m.read).length,
              totalMessages: (t.messages || []).length,
              lastMessage: (t.messages || [])[0] || {},
              thread: t,
            }))
          : [];
        setChats(threads);
        setError(null);
      }
    } catch (e) {
      console.error('[AdminMessagePanel] fetchChats error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch messages for selected chat ──────────────────────────────
  const fetchMessages = useCallback(async (uid) => {
    try {
      const res = await fetch(`${BFF_BASE}/support/threads/${encodeURIComponent(uid)}`, {
<<<<<<< HEAD
        headers: JSON_HEADERS,
=======
        headers,
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        const msgs = data.thread?.messages || [];
        setMessages(msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)));
      }
    } catch (e) {
      console.error('[AdminMessagePanel] fetchMessages error:', e);
    }
  }, []);

  useEffect(() => {
    fetchChats();
    intervalRef.current = setInterval(fetchChats, POLL_INTERVAL_MS);
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [fetchChats]);

  useEffect(() => {
    if (!selectedChat) return;
    fetchMessages(selectedChat.uid);
    const msgInterval = setInterval(() => fetchMessages(selectedChat.uid), POLL_INTERVAL_MS);
    return () => clearInterval(msgInterval);
  }, [selectedChat, fetchMessages]);

  // Keep fetchChats stable
  useEffect(() => {
    // already called at mount; interval handles updates
  }, [fetchChats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send admin reply ──────────────────────────────────────────────
  const handleReply = useCallback(async () => {
    if (!inputText.trim() || !selectedChat || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      // Save to BFF support state
      const res = await fetch(
        `${BFF_BASE}/support/threads/${encodeURIComponent(selectedChat.uid)}/messages`,
        {
          method: 'POST',
<<<<<<< HEAD
          headers: JSON_HEADERS,
=======
          headers,
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
          body: JSON.stringify({
            text,
            sender: 'admin',
            adminName,
          }),
        },
      );

      if (res.ok) {
        // Refresh messages
        await fetchMessages(selectedChat.uid);
        // Refresh chat list
        await fetchChats();
      } else {
        setInputText(text); // restore input on failure
        console.error('[AdminMessagePanel] Reply failed:', res.status);
      }
    } catch (e) {
      setInputText(text);
      console.error('[AdminMessagePanel] Reply error:', e);
    } finally {
      setSending(false);
    }
  }, [inputText, selectedChat, sending, adminName, fetchMessages, fetchChats]);

  const unreadTotal = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 120px)',
      background: 'var(--bg-primary, #0D0D12)',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* ── Left: Chat list ─────────────────────────────────────── */}
      <div style={{
        width: 280,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F2F2F7' }}>
              Support Inbox
            </div>
            <div style={{ fontSize: 10, color: '#636366', marginTop: 2 }}>
              {loading ? 'Loading...' : `${chats.length} conversations`}
            </div>
          </div>
          {unreadTotal > 0 && (
            <span style={{
              background: '#FF3B30',
              color: '#fff',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
            }}>
              {unreadTotal} unread
            </span>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {chats.length === 0 && !loading && (
            <div style={{
              padding: 24, textAlign: 'center', color: '#636366', fontSize: 12,
            }}>
              No support conversations yet.
            </div>
          )}
          {chats.map(chat => (
            <ChatListItem
              key={chat.uid}
              chat={chat}
              isSelected={selectedChat?.uid === chat.uid}
              onClick={() => setSelectedChat(chat)}
            />
          ))}
        </div>

        {loading && chats.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{
              width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)',
              borderTopColor: '#0A84FF', borderRadius: '50%',
              animation: 'cc-spin 0.8s linear infinite',
              margin: '0 auto',
            }} />
          </div>
        )}
      </div>

      {/* ── Right: Chat view ─────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary, #0D0D12)',
      }}>
        {!selectedChat ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#636366', fontSize: 13,
          }}>
            Select a conversation from the left panel.
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F2F2F7' }}>
                  {selectedChat.uid || 'Unknown User'}
                </div>
                <div style={{ fontSize: 10, color: '#636366', marginTop: 2 }}>
                  {selectedChat.totalMessages || 0} messages
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => fetchMessages(selectedChat.uid)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, padding: '4px 10px',
                    color: '#8E8E93', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '16px 20px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#636366', fontSize: 12, padding: 40 }}>
                  No messages in this conversation yet.
                </div>
              )}
              {messages.map((msg, idx) => (
                <MessageBubble key={`${msg.timestamp}_${idx}`} msg={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}>
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
                placeholder="Reply to user..."
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#F2F2F7',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleReply}
                disabled={!inputText.trim() || sending}
                style={{
                  background: inputText.trim() && !sending ? '#0A84FF' : 'rgba(0,122,255,0.3)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 18px',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: inputText.trim() && !sending ? 'pointer' : 'default',
                  opacity: sending ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {sending ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
