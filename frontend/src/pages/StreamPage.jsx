import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../lib/socket';
import { Radio, Users, Play, Square, Send, DollarSign, Loader2 } from 'lucide-react';

export default function StreamPage() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [streams, setStreams] = useState([]);
  const [activeStream, setActiveStream] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [tipAmount, setTipAmount] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newStream, setNewStream] = useState({ title: '', description: '', category: 'General' });

  useEffect(() => {
    fetchStreams();
  }, []);

  useEffect(() => {
    if (streamId) {
      fetchStream(streamId);
      const socket = getSocket();
      if (socket) {
        socket.emit('join_stream', streamId);
        socket.on('stream_comment', (c) => setComments((prev) => [...prev, c]));
        socket.on('stream_ended', () => setActiveStream((s) => s ? { ...s, status: 'ended' } : s));
        return () => {
          socket.emit('leave_stream', streamId);
          socket.off('stream_comment');
          socket.off('stream_ended');
        };
      }
    }
  }, [streamId]);

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/streams?status=live');
      setStreams(data.streams);
    } finally { setLoading(false); }
  };

  const fetchStream = async (id) => {
    try {
      const { data } = await api.get(`/streams/${id}`);
      setActiveStream(data.stream);
    } catch {}
  };

  const createStream = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/streams', newStream);
      navigate(`/streams/${data.stream.id}`);
      setShowCreate(false);
    } catch {}
  };

  const startStream = async () => {
    try {
      await api.post(`/streams/${streamId}/start`);
      setActiveStream((s) => ({ ...s, status: 'live' }));
    } catch {}
  };

  const endStream = async () => {
    try {
      await api.post(`/streams/${streamId}/end`);
      setActiveStream((s) => ({ ...s, status: 'ended' }));
    } catch {}
  };

  const sendComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const { data } = await api.post(`/streams/${streamId}/comments`, { message: commentText });
      setComments((prev) => [...prev, data.comment]);
      setCommentText('');
    } catch {}
  };

  const sendTip = async () => {
    if (!tipAmount || parseFloat(tipAmount) < 0.5) return alert('Minimum tip is $0.50');
    try {
      const { data } = await api.post(`/streams/${streamId}/tip`, { amount: parseFloat(tipAmount) });
      if (data.url) window.open(data.url, '_blank');
    } catch {}
  };

  if (streamId && activeStream) {
    const isOwner = activeStream.user_id === user?.id;
    return (
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stream player area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card aspect-video flex items-center justify-center bg-gray-900 relative overflow-hidden">
            {activeStream.thumbnail_url ? (
              <img src={activeStream.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
            ) : null}
            <div className="relative z-10 text-center">
              <Radio size={48} className="mx-auto mb-3 text-primary-400 opacity-80" />
              <p className="text-gray-300 text-sm">
                {activeStream.status === 'live' ? 'Stream is LIVE' : activeStream.status === 'offline' ? 'Stream not started yet' : 'Stream ended'}
              </p>
            </div>
            {activeStream.status === 'live' && (
              <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">LIVE</span>
            )}
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-white">{activeStream.title}</h2>
            <p className="text-sm text-gray-400 mt-1">{activeStream.description}</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1 text-sm text-gray-400">
                <Users size={14} /> {activeStream.viewer_count} viewers
              </span>
              <span className="text-sm text-gray-500">{activeStream.category}</span>
            </div>
            {isOwner && (
              <div className="flex gap-2 mt-4">
                {activeStream.status !== 'live' && activeStream.status !== 'ended' && (
                  <button onClick={startStream} className="btn-primary flex items-center gap-2 text-sm">
                    <Play size={15} /> Go Live
                  </button>
                )}
                {activeStream.status === 'live' && (
                  <button onClick={endStream} className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                    <Square size={15} /> End Stream
                  </button>
                )}
              </div>
            )}
            {!isOwner && activeStream.status === 'live' && (
              <div className="flex gap-2 mt-4">
                <input
                  type="number"
                  min="0.50"
                  step="0.50"
                  className="input w-28 text-sm"
                  placeholder="$0.00"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                />
                <button onClick={sendTip} className="btn-primary flex items-center gap-1 text-sm">
                  <DollarSign size={14} /> Tip
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat sidebar */}
        <div className="card flex flex-col h-96 lg:h-auto lg:max-h-[calc(100vh-8rem)]">
          <div className="p-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-300">Live Chat</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {comments.map((c, i) => (
              <div key={c.id || i} className="text-sm">
                <span className="font-medium text-primary-400">{c.name} </span>
                <span className="text-gray-300">{c.message}</span>
              </div>
            ))}
          </div>
          <form onSubmit={sendComment} className="p-3 border-t border-gray-800 flex gap-2">
            <input className="input text-sm flex-1 py-1.5" placeholder="Say something…" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
            <button type="submit" className="btn-primary px-3 py-1.5"><Send size={14} /></button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Live Streams</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Radio size={16} /> Go Live
        </button>
      </div>

      {showCreate && (
        <div className="card p-4">
          <h3 className="font-semibold text-white mb-4">Create a stream</h3>
          <form onSubmit={createStream} className="space-y-3">
            <input className="input" placeholder="Stream title" value={newStream.title} onChange={(e) => setNewStream({ ...newStream, title: e.target.value })} required />
            <input className="input" placeholder="Description (optional)" value={newStream.description} onChange={(e) => setNewStream({ ...newStream, description: e.target.value })} />
            <select className="input" value={newStream.category} onChange={(e) => setNewStream({ ...newStream, category: e.target.value })}>
              {['General', 'Gaming', 'Music', 'Tech', 'Art', 'Education', 'Commerce'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button type="submit" className="btn-primary">Create Stream</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary-500" size={28} /></div>
      ) : streams.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Radio size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No live streams right now</p>
          <p className="text-sm mt-1">Be the first to go live!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.map((s) => (
            <button key={s.id} onClick={() => navigate(`/streams/${s.id}`)} className="card p-0 overflow-hidden text-left hover:border-primary-500/50 transition-colors group">
              <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
                {s.thumbnail_url ? <img src={s.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <Radio size={32} className="text-gray-600" />}
                <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">LIVE</span>
                <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                  <Users size={10} /> {s.viewer_count}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-white truncate">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.name || s.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
