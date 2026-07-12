import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../lib/socket';
import {
  Send, Plus, Loader2, MessageCircle, Image, Mic, MicOff,
  X, Reply, Forward, Trash2, Users, UserPlus, MoreHorizontal,
  ChevronLeft, Phone, Video, CheckCheck, Check, Circle,
} from 'lucide-react';
import api from '../api/axios';
import { uploadFile } from '../api/upload';

const MSG_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

function timeAgo(ts) {
  const d = (Date.now() - new Date(ts)) / 1000;
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Group Create Modal ──
function CreateGroupModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  const doSearch = async (q) => {
    setSearch(q);
    if (!q.trim()) return setResults([]);
    try {
      const { data } = await api.get(`/users/search?q=${q}`);
      setResults(data.users || []);
    } catch {}
  };

  const toggle = (u) => {
    setSelected((prev) => prev.find((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || selected.length < 1) return;
    setLoading(true);
    try {
      const { data } = await api.post('/chats', { name: name.trim(), participantIds: selected.map((u) => u.id), is_group: true });
      onCreate(data.chat);
      onClose();
    } catch {} finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="card p-5 w-full max-w-sm space-y-3 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-100">New Group</h3>
          <button type="button" onClick={onClose}><X size={18} className="text-gray-500" /></button>
        </div>
        <input className="input text-sm" placeholder="Group name" required value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input text-sm" placeholder="Search members…" value={search} onChange={(e) => doSearch(e.target.value)} />
        {results.length > 0 && (
          <div className="border border-gray-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
            {results.map((u) => (
              <button key={u.id} type="button" onClick={() => toggle(u)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${selected.find((s) => s.id === u.id) ? 'bg-primary-500/10 text-primary-300' : 'text-gray-300'}`}>
                <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold shrink-0">{u.name?.[0]?.toUpperCase()}</div>
                <div className="min-w-0"><p className="truncate">{u.name}</p><p className="text-xs text-gray-500 truncate">@{u.username}</p></div>
                {selected.find((s) => s.id === u.id) && <CheckCheck size={14} className="ml-auto text-primary-400 shrink-0" />}
              </button>
            ))}
          </div>
        )}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((u) => (
              <span key={u.id} className="bg-primary-500/20 text-primary-300 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                {u.name} <button type="button" onClick={() => toggle(u)}><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
        <button type="submit" disabled={loading || !name.trim() || selected.length < 1} className="btn-primary w-full text-sm">
          {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Create Group (${selected.length + 1} members)`}
        </button>
      </form>
    </div>
  );
}

// ── Message Bubble ──
function MessageBubble({ msg, mine, onReact, onReply, onForward, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactPicker, setShowReactPicker] = useState(false);

  const reactionEntries = msg.reactions ? Object.entries(msg.reactions).filter(([, n]) => n > 0) : [];
  const totalReactions = reactionEntries.reduce((s, [, n]) => s + n, 0);

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
      <div className="relative max-w-xs lg:max-w-md">
        {/* Forwarded label */}
        {msg.forwarded_from && (
          <div className="text-xs text-gray-500 flex items-center gap-1 mb-0.5 px-1">
            <Forward size={10} /> Forwarded from <span className="font-medium">{msg.forwarded_sender_name || 'someone'}</span>
          </div>
        )}

        {/* Reply preview */}
        {msg.reply_message && (
          <div className={`mb-0.5 px-3 py-1.5 rounded-xl text-xs border-l-2 border-primary-400 ${mine ? 'bg-primary-700/40' : 'bg-gray-700/60'}`}>
            <p className="font-medium text-primary-300">{msg.reply_message.sender_name}</p>
            <p className="text-gray-400 truncate">{msg.reply_message.content || '📎 File'}</p>
          </div>
        )}

        <div
          className={`px-3 py-2 rounded-2xl text-sm relative ${mine ? 'bg-primary-500 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm'}`}
          onMouseEnter={() => setShowMenu(true)}
          onMouseLeave={() => { setShowMenu(false); setShowReactPicker(false); }}
        >
          {!mine && <p className="text-xs font-medium text-primary-300 mb-0.5">{msg.name}</p>}

          {/* Voice message */}
          {msg.message_type === 'voice' && (
            <audio controls src={msg.file_url} className="max-w-[200px]" />
          )}

          {/* Image */}
          {msg.message_type === 'image' && msg.file_url && (
            <img src={msg.file_url} alt="" className="rounded-lg max-w-full max-h-48 object-cover mb-1" />
          )}

          {/* Text */}
          {msg.content && <p className="leading-relaxed break-words">{msg.content}</p>}

          <div className="flex items-center gap-1 mt-0.5 justify-end">
            <span className={`text-[10px] ${mine ? 'text-primary-200' : 'text-gray-500'}`}>{formatTime(msg.created_at)}</span>
            {mine && (
              <span title={msg.is_read ? 'Read' : 'Sent'}>
                {msg.is_read
                  ? <CheckCheck size={13} className="text-sky-300" />
                  : <Check size={13} className="text-primary-200" />}
              </span>
            )}
          </div>

          {/* Context menu */}
          {showMenu && (
            <div className={`absolute ${mine ? 'right-full mr-1' : 'left-full ml-1'} top-0 flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-full px-2 py-1 shadow-xl z-20 opacity-0 group-hover:opacity-100 transition-opacity`}>
              <button onClick={() => setShowReactPicker(!showReactPicker)} className="text-gray-400 hover:text-yellow-400 transition-colors" title="React">
                😊
              </button>
              <button onClick={() => onReply(msg)} className="text-gray-400 hover:text-primary-400 transition-colors" title="Reply">
                <Reply size={13} />
              </button>
              <button onClick={() => onForward(msg)} className="text-gray-400 hover:text-green-400 transition-colors" title="Forward">
                <Forward size={13} />
              </button>
              {mine && (
                <button onClick={() => onDelete(msg.id)} className="text-gray-400 hover:text-red-400 transition-colors" title="Delete">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )}

          {/* Reaction picker */}
          {showReactPicker && (
            <div className={`absolute ${mine ? 'right-0' : 'left-0'} bottom-full mb-1 flex gap-1 bg-gray-800 border border-gray-700 rounded-full px-2 py-1.5 shadow-xl z-30 animate-pop`}>
              {MSG_REACTIONS.map((emoji) => (
                <button key={emoji} onClick={() => { onReact(msg.id, emoji); setShowReactPicker(false); }}
                  className="text-lg hover:scale-125 transition-transform leading-none">{emoji}</button>
              ))}
            </div>
          )}
        </div>

        {/* Reactions display */}
        {totalReactions > 0 && (
          <div className={`flex gap-0.5 mt-0.5 ${mine ? 'justify-end' : 'justify-start'}`}>
            {reactionEntries.map(([emoji, count]) => (
              <span key={emoji} className="bg-gray-800 border border-gray-700 rounded-full px-1.5 py-0.5 text-xs flex items-center gap-0.5">
                {emoji} {count > 1 && count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Forward Modal ──
function ForwardModal({ message, chats, onClose, onForward }) {
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      await Promise.all(selected.map((chatId) => onForward(chatId, message)));
      onClose();
    } catch {} finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-4 w-full max-w-sm space-y-3 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-100">Forward Message</h3>
          <button onClick={onClose}><X size={18} className="text-gray-500" /></button>
        </div>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {chats.map((chat) => (
            <label key={chat.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 cursor-pointer">
              <input type="checkbox" checked={selected.includes(chat.id)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, chat.id] : prev.filter((id) => id !== chat.id))} />
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold shrink-0">{(chat.name || 'G')?.[0]?.toUpperCase()}</div>
              <span className="text-sm text-gray-200">{chat.name || 'Chat'}</span>
            </label>
          ))}
        </div>
        <button onClick={send} disabled={sending || selected.length === 0} className="btn-primary w-full text-sm">
          {sending ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Forward to ${selected.length} chat${selected.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    chats, activeChat, messages, loading, fetchChats, setActiveChat, fetchMessages,
    addMessage, patchMessage, markMessagesRead, markChatRead, createChat,
  } = useChatStore();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const audioChunks = useRef([]);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchChats(); }, []);

  useEffect(() => {
    if (chatId) {
      const chat = chats.find((c) => c.id === chatId);
      if (chat) { setActiveChat(chat); fetchMessages(chatId); markChatRead(chatId); }
      const socket = getSocket();
      if (socket) {
        socket.emit('join_chat', chatId);
        socket.on('new_message', (msg) => {
          if (msg.chat_id !== chatId) return;
          addMessage(chatId, msg);
          // I'm looking at this chat, so anything arriving is immediately read
          if (msg.sender_id !== user?.id) markChatRead(chatId);
        });
        socket.on('user_typing', ({ userId: uid, name, isTyping }) => {
          if (uid === user?.id) return;
          setTypingUsers((prev) => isTyping ? [...prev.filter((n) => n !== name), name] : prev.filter((n) => n !== name));
        });
        socket.on('message_reaction', ({ messageId, reactions }) => {
          patchMessage(chatId, messageId, { reactions });
        });
        socket.on('message_deleted', ({ messageId }) => {
          patchMessage(chatId, messageId, { deleted: true });
        });
        socket.on('messages_read', ({ chatId: cid, userId: uid }) => {
          // someone else read this chat → my sent ticks turn blue
          if (cid === chatId && uid !== user?.id) markMessagesRead(chatId);
        });
        return () => {
          socket.emit('leave_chat', chatId);
          socket.off('new_message');
          socket.off('user_typing');
          socket.off('message_reaction');
          socket.off('message_deleted');
          socket.off('messages_read');
        };
      }
    }
  }, [chatId, chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages[chatId]]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !imageUrl.trim()) || !chatId) return;
    setSending(true);
    try {
      if (imageUrl.trim()) {
        await api.post(`/messages/${chatId}`, { content: text.trim() || null, message_type: 'image', file_url: imageUrl.trim(), reply_to: replyTo?.id });
        setImageUrl('');
        setShowImageInput(false);
      } else {
        await api.post(`/messages/${chatId}`, { content: text.trim(), reply_to: replyTo?.id });
      }
      setText('');
      setReplyTo(null);
    } catch {} finally { setSending(false); }
  };

  // Real image attachment: pick a file → upload to storage → send as image message.
  // Falls back to the image-URL input when the server has no storage configured.
  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !chatId) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, 'chat');
      await api.post(`/messages/${chatId}`, {
        content: text.trim() || null,
        message_type: 'image',
        file_url: url,
        file_name: file.name,
        reply_to: replyTo?.id,
      });
      setText('');
      setReplyTo(null);
    } catch (err) {
      if (err.response?.status === 503) setShowImageInput(true);
      else alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const reactToMessage = async (messageId, reaction) => {
    try {
      const { data } = await api.post(`/messages/${chatId}/${messageId}/react`, { reaction });
      // The socket event updates the store; if not connected, update locally
    } catch {}
  };

  const deleteMessage = async (messageId) => {
    if (!confirm('Delete this message?')) return;
    try {
      await api.delete(`/messages/${chatId}/${messageId}`);
    } catch {}
  };

  const forwardMessage = async (targetChatId, msg) => {
    await api.post(`/messages/${targetChatId}`, {
      content: msg.content,
      forwarded_from: msg.id,
      message_type: msg.message_type,
      file_url: msg.file_url,
    });
  };

  const handleTyping = () => {
    const socket = getSocket();
    if (!socket || !chatId) return;
    socket.emit('typing', { chatId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit('typing', { chatId, isTyping: false }), 2000);
  };

  const doUserSearch = async (q) => {
    setNewChatSearch(q);
    if (!q.trim()) return setSearchResults([]);
    try {
      const { data } = await api.get(`/users/search?q=${q}`);
      setSearchResults(data.users || []);
    } catch {}
  };

  const startChatWith = async (u) => {
    try {
      const { data } = await api.post('/chats', { participantIds: [u.id] });
      await fetchChats();
      setNewChatSearch(''); setSearchResults([]); setShowNewChat(false);
      navigate(`/chats/${data.chat.id}`);
    } catch {}
  };

  // Voice recording (WhatsApp-style)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunks.current = [];
      mr.ondataavailable = (e) => audioChunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        let url;
        try {
          url = await uploadFile(new File([blob], 'voice.webm', { type: 'audio/webm' }), 'chat');
        } catch {
          // storage not configured — local object URL (sender-only preview)
          url = URL.createObjectURL(blob);
        }
        await api.post(`/messages/${chatId}`, {
          content: '🎤 Voice message',
          message_type: 'voice',
          file_url: url,
          reply_to: replyTo?.id,
        });
        setReplyTo(null);
      };
      mr.start();
      setMediaRecorder(mr);
      setRecording(true);
    } catch (err) {
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
    setMediaRecorder(null);
  };

  const chatMessages = (messages[chatId] || []).filter((m) => !m.deleted);

  // Online indicator for DM
  const otherUser = activeChat?.participants?.find((p) => p.id !== user?.id);

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-screen -mx-4 -my-6">
      {/* ── Sidebar ── */}
      <div className={`w-full md:w-80 bg-gray-900 border-r border-gray-800 flex flex-col ${chatId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Messages</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewGroup(true)} title="New Group" className="text-gray-400 hover:text-primary-400 transition-colors">
              <Users size={18} />
            </button>
            <button onClick={() => setShowNewChat(!showNewChat)} title="New Chat" className="text-primary-400 hover:text-primary-300 transition-colors">
              <Plus size={20} />
            </button>
          </div>
        </div>

        {showNewChat && (
          <div className="p-3 border-b border-gray-800 space-y-1">
            <input className="input text-sm" placeholder="Search people…" value={newChatSearch} onChange={(e) => doUserSearch(e.target.value)} autoFocus />
            {searchResults.map((u) => (
              <button key={u.id} onClick={() => startChatWith(u)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left">
                <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold shrink-0">{u.name?.[0]?.toUpperCase()}</div>
                <div className="min-w-0"><p className="text-sm text-gray-200 truncate">{u.name}</p><p className="text-xs text-gray-500">@{u.username}</p></div>
                {u.is_online && <div className="w-2 h-2 bg-green-400 rounded-full ml-auto shrink-0" />}
              </button>
            ))}
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
              const displayName = chat.is_group ? chat.name : (other?.name || 'Chat');
              return (
                <button
                  key={chat.id}
                  onClick={() => navigate(`/chats/${chat.id}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left ${chat.id === chatId ? 'bg-gray-800' : ''}`}
                >
                  <div className="relative w-10 h-10 shrink-0">
                    {chat.is_group ? (
                      <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                        <Users size={18} className="text-primary-400" />
                      </div>
                    ) : other?.avatar ? (
                      <img src={other.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold">
                        {displayName?.[0]?.toUpperCase()}
                      </div>
                    )}
                    {!chat.is_group && other?.is_online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${chat.unread_count > 0 ? 'font-semibold text-white' : 'font-medium text-gray-100'}`}>{displayName}</p>
                    <p className={`text-xs truncate ${chat.unread_count > 0 ? 'text-gray-300' : 'text-gray-500'}`}>{chat.last_message || 'No messages yet'}</p>
                  </div>
                  <div className="ml-auto shrink-0 flex flex-col items-end gap-1">
                    {chat.last_message_at && (
                      <span className={`text-xs ${chat.unread_count > 0 ? 'text-green-400' : 'text-gray-600'}`}>{timeAgo(chat.last_message_at)}</span>
                    )}
                    {chat.unread_count > 0 && chat.id !== chatId && (
                      <span className="bg-green-500 text-gray-950 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                        {chat.unread_count > 99 ? '99+' : chat.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Chat Window ── */}
      {chatId ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
            <button className="md:hidden text-gray-400 mr-1" onClick={() => navigate('/chats')}>
              <ChevronLeft size={20} />
            </button>
            <div className="relative w-9 h-9 shrink-0">
              {activeChat?.is_group ? (
                <div className="w-9 h-9 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <Users size={16} className="text-primary-400" />
                </div>
              ) : otherUser?.avatar ? (
                <img src={otherUser.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold">
                  {(activeChat?.name || otherUser?.name || 'C')?.[0]?.toUpperCase()}
                </div>
              )}
              {!activeChat?.is_group && otherUser?.is_online && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-gray-900" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-100 truncate">
                {activeChat?.name || otherUser?.name || 'Chat'}
              </p>
              {typingUsers.length > 0 ? (
                <p className="text-xs text-primary-400">{typingUsers.join(', ')} typing…</p>
              ) : !activeChat?.is_group && otherUser ? (
                <p className="text-xs text-gray-500">
                  {otherUser.is_online
                    ? <span className="text-green-400">● Online</span>
                    : otherUser.last_seen ? `last seen ${timeAgo(otherUser.last_seen)}` : 'Offline'}
                </p>
              ) : activeChat?.is_group ? (
                <p className="text-xs text-gray-500">{activeChat.participants?.length} members</p>
              ) : null}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
            {chatMessages.map((msg) => {
              const mine = msg.sender_id === user?.id;
              return (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  mine={mine}
                  onReact={reactToMessage}
                  onReply={setReplyTo}
                  onForward={setForwardMsg}
                  onDelete={deleteMessage}
                />
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply bar */}
          {replyTo && (
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800/80 border-t border-gray-700 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Reply size={14} className="text-primary-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-primary-300 text-xs font-medium">{replyTo.name}</p>
                  <p className="text-gray-400 text-xs truncate">{replyTo.content || '📎 File'}</p>
                </div>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-gray-300 ml-2 shrink-0">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Image URL input */}
          {showImageInput && (
            <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-800 bg-gray-900/80">
              <Image size={14} className="text-gray-500 shrink-0" />
              <input type="url" className="input text-sm flex-1 py-1.5" placeholder="Image URL…"
                value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(e); } }} />
              <button onClick={() => { setImageUrl(''); setShowImageInput(false); }} className="text-gray-500 hover:text-red-400">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={sendMessage} className="p-4 border-t border-gray-800 flex gap-2 items-end">
            <div className="flex gap-1 shrink-0">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden" onChange={handleFilePick} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className={`p-2 rounded-full transition-colors ${uploading ? 'text-primary-400 bg-primary-500/10' : 'text-gray-500 hover:text-primary-400 hover:bg-gray-800'}`}
                title="Send photo">
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Image size={18} />}
              </button>
              <button type="button"
                onClick={recording ? stopRecording : startRecording}
                className={`p-2 rounded-full transition-colors ${recording ? 'text-red-400 bg-red-500/10 animate-pulse' : 'text-gray-500 hover:text-primary-400 hover:bg-gray-800'}`}
                title={recording ? 'Stop recording' : 'Voice message'}>
                {recording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>
            <input
              className="input flex-1"
              placeholder={recording ? '🔴 Recording…' : 'Type a message…'}
              value={text}
              disabled={recording}
              onChange={(e) => { setText(e.target.value); handleTyping(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(e); }}
            />
            <button type="submit" disabled={sending || recording || (!text.trim() && !imageUrl.trim())} className="btn-primary px-3 py-2 rounded-full shrink-0">
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

      {showNewGroup && (
        <CreateGroupModal
          onClose={() => setShowNewGroup(false)}
          onCreate={(chat) => { fetchChats(); navigate(`/chats/${chat.id}`); }}
        />
      )}

      {forwardMsg && (
        <ForwardModal
          message={forwardMsg}
          chats={chats}
          onClose={() => setForwardMsg(null)}
          onForward={forwardMessage}
        />
      )}
    </div>
  );
}
