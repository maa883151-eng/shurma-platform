import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../lib/socket';
import VideoPlayer from '../components/VideoPlayer';
import {
  Radio, Plus, Search, Users, X, Loader2, Send, Heart,
  Pin, ChevronLeft, ImageIcon, Video, CheckCircle2
} from 'lucide-react';

function timeAgo(ts) {
  const s = (Date.now() - new Date(ts)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function CreateChannelModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', handle: '', description: '', category: 'General', avatar: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const CATS = ['General', 'News', 'Tech', 'Entertainment', 'Sports', 'Education', 'Music', 'Gaming'];

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/channels', form);
      onCreated(data.channel);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="card p-5 w-full max-w-sm space-y-3 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-100">Create Channel</h3>
          <button type="button" onClick={onClose}><X size={18} className="text-gray-500" /></button>
        </div>
        <input className="input text-sm" placeholder="Channel name" required value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} />
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">@</span>
          <input className="input text-sm flex-1" placeholder="handle" required value={form.handle}
            onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} />
        </div>
        <textarea className="input text-sm resize-none" rows={2} placeholder="Description…" value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        <select className="input text-sm" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input type="url" className="input text-sm" placeholder="Avatar URL (optional)" value={form.avatar}
          onChange={(e) => setForm((f) => ({ ...f, avatar: e.target.value }))} />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full text-sm">
          {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Create Channel'}
        </button>
      </form>
    </div>
  );
}

function ChannelPost({ post, channelId, isOwner, onPin }) {
  const [liked, setLiked] = useState(post.is_liked);
  const [likes, setLikes] = useState(parseInt(post.likes_count) || 0);

  const toggleLike = async () => {
    try {
      if (liked) {
        await api.delete(`/channels/${channelId}/posts/${post.id}/like`);
        setLiked(false); setLikes((l) => l - 1);
      } else {
        await api.post(`/channels/${channelId}/posts/${post.id}/like`);
        setLiked(true); setLikes((l) => l + 1);
      }
    } catch {}
  };

  return (
    <div className={`card p-4 space-y-3 ${post.is_pinned ? 'border-primary-500/40' : ''}`}>
      {post.is_pinned && (
        <div className="flex items-center gap-1.5 text-xs text-primary-400">
          <Pin size={11} /> Pinned
        </div>
      )}
      <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

      {post.video_url && <VideoPlayer src={post.video_url} className="w-full" />}

      {post.images?.length > 0 && (
        <div className={`grid gap-1 ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {post.images.map((img, i) => (
            <img key={i} src={img} alt="" className="w-full rounded-lg object-cover max-h-64" />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={toggleLike} className={`flex items-center gap-1 transition-colors ${liked ? 'text-red-400' : 'hover:text-red-400'}`}>
            <Heart size={14} fill={liked ? 'currentColor' : 'none'} /> {likes}
          </button>
          <span>{parseInt(post.views_count || 0).toLocaleString()} views</span>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && !post.is_pinned && (
            <button onClick={() => onPin(post.id)} className="hover:text-primary-400 transition-colors">
              <Pin size={13} />
            </button>
          )}
          <span>{timeAgo(post.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function ChannelView({ channel: initialChannel, onBack }) {
  const { user } = useAuthStore();
  const [channel, setChannel] = useState(initialChannel);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({ content: '', images: '', video_url: '' });
  const [showCompose, setShowCompose] = useState(false);

  const isOwner = channel.owner_id === user?.id;

  useEffect(() => {
    fetchPosts();
    const socket = getSocket();
    if (socket) {
      socket.emit('join_channel', channel.id);
      socket.on('new_channel_post', (post) => setPosts((prev) => [post, ...prev]));
      return () => { socket.emit('leave_channel', channel.id); socket.off('new_channel_post'); };
    }
  }, [channel.id]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/channels/${channel.id}/posts`);
      setPosts(data.posts);
    } catch {} finally { setLoading(false); }
  };

  const toggleSub = async () => {
    try {
      if (channel.is_subscribed) {
        await api.delete(`/channels/${channel.id}/subscribe`);
        setChannel((c) => ({ ...c, is_subscribed: false, subscriber_count: Math.max(0, c.subscriber_count - 1) }));
      } else {
        await api.post(`/channels/${channel.id}/subscribe`);
        setChannel((c) => ({ ...c, is_subscribed: true, subscriber_count: c.subscriber_count + 1 }));
      }
    } catch {}
  };

  const publish = async (e) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    setPosting(true);
    try {
      const images = form.images ? form.images.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
      const { data } = await api.post(`/channels/${channel.id}/posts`, {
        content: form.content.trim(),
        images,
        video_url: form.video_url || undefined,
      });
      setPosts((prev) => [data.post, ...prev]);
      setForm({ content: '', images: '', video_url: '' });
      setShowCompose(false);
    } catch {} finally { setPosting(false); }
  };

  const pin = async (postId) => {
    try {
      await api.post(`/channels/${channel.id}/posts/${postId}/pin`);
      setPosts((prev) => prev.map((p) => ({ ...p, is_pinned: p.id === postId })));
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card overflow-hidden animate-slide-up">
        {channel.banner ? (
          <img src={channel.banner} alt="" className="w-full h-24 object-cover" />
        ) : (
          <div className="h-24 bg-gradient-to-r from-primary-700 via-primary-500 to-pink-500" />
        )}
        <div className="p-4">
          <div className="flex items-end justify-between -mt-10 mb-3">
            {channel.avatar ? (
              <img src={channel.avatar} alt="" className="w-16 h-16 rounded-full object-cover border-4 border-gray-900" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-2xl font-bold border-4 border-gray-900">
                <Radio size={20} className="text-white" />
              </div>
            )}
            <div className="flex gap-2">
              {isOwner && (
                <button onClick={() => setShowCompose(true)} className="btn-primary text-sm flex items-center gap-1.5">
                  <Plus size={14} /> Post
                </button>
              )}
              {!isOwner && (
                <button onClick={toggleSub} className={channel.is_subscribed ? 'btn-ghost text-sm border border-gray-700' : 'btn-primary text-sm'}>
                  {channel.is_subscribed ? 'Subscribed' : 'Subscribe'}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">{channel.name}</h2>
            {channel.is_verified && <CheckCircle2 size={16} className="text-primary-400" />}
          </div>
          <p className="text-gray-500 text-sm">@{channel.handle} · {channel.category}</p>
          {channel.description && <p className="text-gray-400 text-sm mt-1">{channel.description}</p>}
          <div className="flex gap-4 mt-3 text-sm">
            <span><strong className="text-white">{channel.subscriber_count.toLocaleString()}</strong> <span className="text-gray-500">subscribers</span></span>
            <span><strong className="text-white">{channel.post_count}</strong> <span className="text-gray-500">posts</span></span>
          </div>
        </div>
      </div>

      {/* Compose (owner only) */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCompose(false)}>
          <form onSubmit={publish} className="card p-4 w-full max-w-lg space-y-3 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-100">New post to {channel.name}</h3>
              <button type="button" onClick={() => setShowCompose(false)}><X size={18} className="text-gray-500" /></button>
            </div>
            <textarea className="input resize-none text-sm" rows={4} placeholder="Write your post…"
              value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} required />
            <div className="flex items-center gap-2">
              <ImageIcon size={14} className="text-gray-500" />
              <input type="text" className="input text-sm flex-1 py-1.5" placeholder="Image URLs (comma-separated)"
                value={form.images} onChange={(e) => setForm((f) => ({ ...f, images: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Video size={14} className="text-gray-500" />
              <input type="url" className="input text-sm flex-1 py-1.5" placeholder="Video URL (optional)"
                value={form.video_url} onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))} />
            </div>
            <button type="submit" disabled={posting || !form.content.trim()} className="btn-primary w-full text-sm">
              {posting ? <Loader2 size={16} className="animate-spin mx-auto" /> : <><Send size={14} className="inline mr-1" /> Publish</>}
            </button>
          </form>
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary-500" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Radio size={32} className="mx-auto mb-2 opacity-30" />
          <p>{isOwner ? 'Publish your first post.' : 'No posts yet.'}</p>
        </div>
      ) : (
        posts.map((p) => <ChannelPost key={p.id} post={p} channelId={channel.id} isOwner={isOwner} onPin={pin} />)
      )}
    </div>
  );
}

export default function ChannelsPage() {
  const navigate = useNavigate();
  const { handle } = useParams();
  const { user } = useAuthStore();
  const [channels, setChannels] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('discover');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (handle && channels.length) {
      const ch = channels.find((c) => c.handle === handle);
      if (ch) setSelected(ch);
    }
  }, [handle, channels]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [disc, subscribed] = await Promise.all([
        api.get('/channels'),
        api.get('/channels/mine'),
      ]);
      setChannels(disc.data.channels);
      setMine(subscribed.data.channels);
    } catch {} finally { setLoading(false); }
  };

  const filtered = channels.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.handle.includes(q.toLowerCase())
  );

  if (selected) {
    return (
      <div>
        <button
          onClick={() => { setSelected(null); navigate('/channels'); }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-4 transition-colors"
        >
          <ChevronLeft size={16} /> All Channels
        </button>
        <ChannelView channel={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio size={20} className="text-primary-400" /> Channels
        </h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus size={14} /> Create
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input className="input pl-9 text-sm" placeholder="Search channels…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
        {[['discover', 'Discover'], ['subscribed', 'Subscribed']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Channel list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary-500" /></div>
      ) : (
        <div className="space-y-3">
          {(tab === 'subscribed' ? mine : filtered).map((ch) => (
            <button
              key={ch.id}
              onClick={() => { setSelected(ch); navigate(`/channels/${ch.handle}`); }}
              className="w-full card p-4 flex items-center gap-3 hover:border-primary-500/40 transition-colors text-left"
            >
              {ch.avatar ? (
                <img src={ch.avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center shrink-0">
                  <Radio size={18} className="text-primary-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-gray-100 truncate">{ch.name}</p>
                  {ch.is_verified && <CheckCircle2 size={13} className="text-primary-400 shrink-0" />}
                </div>
                <p className="text-xs text-gray-500">@{ch.handle} · {ch.category}</p>
                {ch.description && <p className="text-xs text-gray-500 truncate mt-0.5">{ch.description}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">{ch.subscriber_count.toLocaleString()}</p>
                <p className="text-xs text-gray-600">subs</p>
                {ch.is_subscribed && (
                  <span className="text-xs text-primary-400 mt-1 block">✓ Joined</span>
                )}
              </div>
            </button>
          ))}
          {(tab === 'subscribed' ? mine : filtered).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p>{tab === 'subscribed' ? 'No subscriptions yet.' : 'No channels found.'}</p>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateChannelModal
          onClose={() => setShowCreate(false)}
          onCreated={(ch) => { setChannels((prev) => [ch, ...prev]); setSelected(ch); navigate(`/channels/${ch.handle}`); }}
        />
      )}
    </div>
  );
}
