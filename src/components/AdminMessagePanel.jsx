/**
 * ═══════════════════════════════════════════════════════════════════
 * ADMIN MESSAGE PANEL - Phase 4
 * ═══════════════════════════════════════════════════════════════════
 *
 * Component: AdminMessagePanel
 * Purpose: A UI for admins to view and reply to support chats.
 *
 * Task: 4.6
 */

import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, push, serverTimestamp } from 'firebase/database';

function AdminMessagePanel() {
    const [chatList, setChatList] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    let db = null;
    try {
        db = getDatabase();
    } catch {
        db = null;
    }

    // Fetch the list of all support chats
    useEffect(() => {
        if (!db) {
            return;
        }
        const chatsRef = ref(db, 'support_chats');
        onValue(chatsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.keys(data).map(uid => ({
                    uid,
                    // You would fetch user email/name here based on UID
                    identifier: `User ${uid.substring(0, 6)}...` 
                }));
                setChatList(list);
            }
        });
    }, [db]);

    // Fetch messages for the selected chat
    useEffect(() => {
        if (!db) {
            return;
        }
        if (!selectedChat) return;
        const messagesRef = ref(db, `support_chats/${selectedChat.uid}/messages`);
        onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const messagesArray = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setMessages(messagesArray);
            } else {
                setMessages([]);
            }
        });
    }, [selectedChat, db]);

    const handleReply = () => {
        if (!db || !selectedChat || inputText.trim() === "") return;

        const messagesRef = ref(db, `support_chats/${selectedChat.uid}/messages`);
        const newMessage = {
            text: inputText,
            sender: 'admin',
            timestamp: serverTimestamp(),
        };
        push(messagesRef, newMessage);
        setInputText("");
    }

    return (
        <div style={styles.panel}>
            <div style={styles.chatList}>
                <h3>Support Chats</h3>
                {chatList.map(chat => (
                    <div 
                        key={chat.uid} 
                        style={styles.chatListItem}
                        onClick={() => setSelectedChat(chat)}
                    >
                        {chat.identifier}
                    </div>
                ))}
            </div>
            <div style={styles.chatView}>
                {selectedChat ? (
                    <>
                        <h3>Chat with {selectedChat.identifier}</h3>
                        <div style={styles.messageArea}>
                             {messages.map((msg) => (
                                <div key={msg.id} style={msg.sender === 'user' ? styles.userMessage : styles.adminMessage}>
                                    {msg.text}
                                </div>
                            ))}
                        </div>
                        <div style={styles.inputArea}>
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleReply()}
                                style={styles.input}
                                placeholder="Type a reply..."
                            />
                            <button onClick={handleReply} style={styles.sendButton}>Reply</button>
                        </div>
                    </>
                ) : (
                    <p>Select a chat to view messages.</p>
                )}
            </div>
        </div>
    );
}

const styles = {
    panel: { display: 'flex', height: '80vh', border: '1px solid #ccc' },
    chatList: { width: '250px', borderRight: '1px solid #ccc', overflowY: 'auto' },
    chatListItem: { padding: '15px', cursor: 'pointer', borderBottom: '1px solid #eee' },
    chatView: { flex: 1, display: 'flex', flexDirection: 'column' },
    messageArea: { flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' },
    inputArea: { display: 'flex', padding: '10px', borderTop: '1px solid #eee' },
    input: { flex: 1, padding: '10px' },
    sendButton: { padding: '10px' },
    userMessage: { alignSelf: 'flex-start', backgroundColor: '#E5E5EA', color: 'black', padding: '8px 12px', borderRadius: '15px 15px 15px 0' },
    adminMessage: { alignSelf: 'flex-end', backgroundColor: '#007AFF', color: 'white', padding: '8px 12px', borderRadius: '15px 15px 0 15px' },
};

export default AdminMessagePanel;
