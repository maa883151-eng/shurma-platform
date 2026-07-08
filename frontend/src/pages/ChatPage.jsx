import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../lib/socket';
import { Send, Plus, Loader2, MessageCircle } from 'lucide-react';
import api from '../api/axios';

function timeAgo(ts) {
  const d = (Date.now() - new Date(ts)) / 1000;
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { chats, activeChat, messages, loading, fetchChats, setActiveChat, fetchMessages, addMessage, createChat } = useChatStore();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => { fetchChats(); }, []);

  useEffect(() => {
    if (chatId) {
      const chat = chats.find((c) => c.id === chatId);
      if (chat) { setActiveChat(chat); fetchMessages(chatId); }
      const socket = getSocket();
      if (socket) {
        socket.emit('join_chat', chatId);
        socket.on('new_message', (msg) => { if (msg.chat_id === chatId) addMessage(chatId, msg); });
        socket.on('user_typing', ({ userId: uid, name, isTyping }) => {
          if (uid === user?.id) return;
          setTypingUsers((prev) => isTyping ? [...prev.filter((n) => n !== name), name] : prev.filter((n) => n !== name));
        });
        return () => {
          socket.emit('leave_chat', chatId);
          socket.off('new_message');
          socket.off('user_typing');
        };
      }
    }
  }, [chatId, chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages[chatId]]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() || !chatId) return;
    setSending(true);
    try {
      await api.post(`/messages/${chatId}`, { content: text.trim() });
      setText('');
    } catch {} finally { setSending(false); }
  };

  const handleTyping = () => {
    const socket = getSocket();
    if (!socket || !chatId) return;
    socket.emit('typing', { chatId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit('typing', { chatId, isTyping: false }), 2000);
  };

  const startNewChat = async () => {
    if (!newChatEmail.trim()) return;
    try {
      const { data } = await api.get(`/users/search?q=${newChatEmail}`);
      if (!data.users[0]) return alert('User not found');
      const chat = await createChat([data.users[0].id]);
      setNewChatEmail(''); setShowNewChat(false);
      navigate(`/chats/${chat.id}`);
    } catch {}
  };

  const chatMessages = messages[chatId] || [];

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-0px)] -mx-4 -my-6">
      {/* Sidebar */}
      <div className={`w-full md:w-80 bg-gray-900 border-r border-gray-800 flex flex-col ${chatId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Messages</h2>
          <button onClick={() => setShowNewChat(!showNewChat)} className="text-primary-400 hover:text-primary-300">
            <Plus size={20} />
          </button>
        </div>
        {showNewChat && (
          <div className="p-3 border-b border-gray-800 flex gap-2">
            <input className="input text-sm flex-1" placeholder="Search username…" value={newChatEmail} onChange={(e) => setNewChatEmail(e.target.value)} />
            <button onClick={startNewChat} className="btn-primary text-sm px-3 py-1.5">Go</button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary-500" /></div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-500 p-6 text-center">
            <MessageCircle size={36} className="mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {chats.map((chat) => {
              const other = chat.participants?.find((p) => p.id !== user?.id);
              return (
                <button
                  key={chat.id}
                  onClick={() => navigate(`/chats/${chat.id}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left ${chat.id === chatId ? 'bg-gray-800' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold shrink-0">
                    {other?.name?.[0]?.toUpperCase() || 'G'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">{chat.name || other?.name || 'Group'}</p>
                    <p className="text-xs text-gray-500 truncate">{chat.last_message || 'No messages yet'}</p>
                  </div>
                  {chat.last_message_at && (
                    <span className="text-xs text-gray-600 ml-auto shrink-0">{timeAgo(chat.last_message_at)}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat window */}
      {chatId ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
            <button className="md:hidden text-gray-400 mr-1" onClick={() => navigate('/chats')}>←</button>
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold">
              {activeChat?.name?.[0]?.toUpperCase() || 'C'}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-100">
                {activeChat?.name || activeChat?.participants?.find((p) => p.id !== user?.id)?.name || 'Chat'}
              </p>
              {typingUsers.length > 0 && (
                <p className="text-xs text-primary-400">{typingUsers.join(', ')} typing…</p>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {chatMessages.map((msg) => {
              const mine = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-primary-500 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm'}`}>
                    {!mine && <p className="text-xs font-medium text-primary-300 mb-1">{msg.name}</p>}
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className={`text-xs mt-1 ${mine ? 'text-primary-200' : 'text-gray-500'}`}>{timeAgo(msg.created_at)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="p-4 border-t border-gray-800 flex gap-2">
            <input
              className="input flex-1"
              placeholder="Type a message…"
              value={text}
              onChange={(e) => { setText(e.target.value); handleTyping(); }}
            />
            <button type="submit" disabled={sending || !text.trim()} className="btn-primary px-4">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-gray-600">
          <div className="text-center">
            <MessageCircle size={48} className="mx-auto mb-3 opacity-30" />
            <p>Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}
