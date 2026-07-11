import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import VideoPlayer from '../components/VideoPlayer';
import {
  ListVideo, Clock, Plus, X, Loader2, Trash2, PlayCircle,
  Globe, Lock, Film, ChevronLeft
} from 'lucide-react';

function timeAgo(ts) {
  const s = (Date.now() - new Date(ts)) / 1000;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PlaylistDetail({ playlist: pl, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(null);

  useEffect(() => {
    api.get(`/playlists/${pl.id}`).then(({ data }) => { setItems(data.items); setLoading(false); }).catch(() => setLoading(false));
  }, [pl.id]);

  const remove = async (postId) => {
    try {
      await api.delete(`/playlists/${pl.id}/items/${postId}`);
      setItems((prev) => prev.filter((i) => i.post_id !== postId));
    } catch {}
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
        <ChevronLeft size={16} /> All Playlists
      </button>

      <div className="card p-4">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
            <ListVideo size={24} className="text-primary-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-lg">{pl.name}</h2>
            {pl.description && <p className="text-gray-400 text-sm mt-0.5">{pl.description}</p>}
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
              {pl.is_public ? <Globe size={11} /> : <Lock size={11} />}
              {pl.is_public ? 'Public' : 'Private'} · {pl.item_count} items
            </p>
          </div>
        </div>
      </div>

      {playing && (
        <div className="card p-3">
          <VideoPlayer src={playing.video_url || playing.image_url} className="w-full" autoPlay />
          <p className="text-sm text-gray-200 mt-2 font-medium truncate">{playing.content}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Film size={32} className="mx-auto mb-2 opacity-30" />
          <p>No items in this playlist.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item.id} className="card p-3 flex items-center gap-3 hover:border-primary-500/30 transition-colors">
              <span className="text-xs text-gray-600 w-5 text-center">{i + 1}</span>
              {item.video_url || item.image_url ? (
                <div className="w-16 h-12 bg-gray-800 rounded overflow-hidden shrink-0">
                  {item.images?.[0] || item.image_url ? (
                    <img src={item.images?.[0] || item.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Film size={16} className="text-gray-600" /></div>
                  )}
                </div>
              ) : null}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{item.content}</p>
                <p className="text-xs text-gray-500">{item.name} · {timeAgo(item.post_created_at)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(item.video_url) && (
                  <button onClick={() => setPlaying(item)} className="text-primary-400 hover:text-primary-300">
                    <PlayCircle size={18} />
                  </button>
                )}
                <button onClick={() => remove(item.post_id)} className="text-gray-600 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlaylistsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('playlists');
  const [playlists, setPlaylists] = useState([]);
  const [watchLater, setWatchLater] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [plRes, wlRes] = await Promise.all([
        api.get('/playlists'),
        api.get('/playlists/watch-later'),
      ]);
      setPlaylists(plRes.data.playlists);
      setWatchLater(wlRes.data.posts);
    } catch {} finally { setLoading(false); }
  };

  const createPlaylist = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/playlists', { name: newName.trim(), description: newDesc, is_public: isPublic });
      setPlaylists((prev) => [data.playlist, ...prev]);
      setNewName(''); setNewDesc(''); setShowCreate(false);
    } catch {} finally { setCreating(false); }
  };

  const removeWL = async (postId) => {
    try {
      await api.delete(`/playlists/watch-later/${postId}`);
      setWatchLater((prev) => prev.filter((p) => p.id !== postId));
    } catch {}
  };

  const deletePlaylist = async (id) => {
    try {
      await api.delete(`/playlists/${id}`);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    } catch {}
  };

  if (selected) {
    return <PlaylistDetail playlist={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ListVideo size={20} className="text-primary-400" /> Library
        </h1>
        {tab === 'playlists' && (
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus size={14} /> New Playlist
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
        {[['playlists', 'Playlists', ListVideo], ['watch-later', 'Watch Later', Clock]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${tab === key ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {showCreate && (
        <form onSubmit={createPlaylist} className="card p-4 space-y-3 animate-fade-in">
          <p className="text-sm font-semibold text-gray-200">New Playlist</p>
          <input className="input text-sm" placeholder="Playlist name" required value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="input text-sm" placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Public playlist
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="btn-primary text-sm flex-1">
              {creating ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Create'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost text-sm flex-1 border border-gray-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary-500" /></div>
      ) : tab === 'playlists' ? (
        playlists.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ListVideo size={32} className="mx-auto mb-2 opacity-30" />
            <p>No playlists yet. Create one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {playlists.map((pl) => (
              <div key={pl.id} className="card p-0 overflow-hidden hover:border-primary-500/40 transition-colors">
                <button className="w-full" onClick={() => setSelected(pl)}>
                  <div className="aspect-video bg-gray-800 flex items-center justify-center">
                    {pl.cover_thumb ? (
                      <img src={pl.cover_thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ListVideo size={24} className="text-gray-600" />
                    )}
                  </div>
                  <div className="p-3 text-left">
                    <p className="text-sm font-medium text-gray-100 truncate">{pl.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      {pl.is_public ? <Globe size={10} /> : <Lock size={10} />}
                      {pl.item_count} videos
                    </p>
                  </div>
                </button>
                <button onClick={() => deletePlaylist(pl.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/60 rounded-full p-1 text-gray-400 hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        watchLater.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock size={32} className="mx-auto mb-2 opacity-30" />
            <p>No videos saved to Watch Later.</p>
            <p className="text-xs mt-1">Tap the clock icon on any video post.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {watchLater.map((post) => (
              <div key={post.id} className="card p-3 flex items-center gap-3">
                <div className="w-20 h-14 bg-gray-800 rounded overflow-hidden shrink-0">
                  {post.video_url ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                      <PlayCircle size={20} className="text-primary-400" />
                    </div>
                  ) : post.image_url ? (
                    <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Film size={16} className="text-gray-600" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{post.content}</p>
                  <p className="text-xs text-gray-500">{post.name} · {timeAgo(post.created_at)}</p>
                </div>
                <button onClick={() => removeWL(post.id)} className="text-gray-600 hover:text-red-400 shrink-0">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
