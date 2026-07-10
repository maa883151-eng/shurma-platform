import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../lib/socket';
import { Plus, X, ChevronLeft, ChevronRight, Eye, Trash2, Loader2, Image } from 'lucide-react';

const STORY_DURATION = 5000;
const BG_COLORS = ['#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0284c7', '#111827'];

function ring(unviewed) {
  return unviewed
    ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600'
    : 'bg-gray-700';
}

function StoryAvatar({ user, unviewed, onClick, label }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 shrink-0 w-16 hover:scale-105 active:scale-95 transition-transform">
      <div className={`p-[2.5px] rounded-full ${ring(unviewed)}`}>
        <div className="p-[2px] bg-gray-900 rounded-full">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <span className="text-[11px] text-gray-400 truncate w-full text-center">{label}</span>
    </button>
  );
}

function CreateStoryModal({ onClose, onCreated }) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!content.trim() && !imageUrl) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/stories', {
        content: content.trim() || undefined,
        image_url: imageUrl || undefined,
        bg_color: bgColor,
      });
      onCreated(data.story);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create story');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-4 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-100">New story</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>

        {/* Preview */}
        <div
          className="rounded-xl h-64 flex items-center justify-center p-4 overflow-hidden relative"
          style={{ backgroundColor: bgColor }}
        >
          {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          {content && (
            <p className="relative text-white text-lg font-semibold text-center break-words drop-shadow-lg">
              {content}
            </p>
          )}
          {!content && !imageUrl && <p className="text-white/50 text-sm">Your story preview</p>}
        </div>

        <textarea
          rows={2}
          className="input resize-none text-sm"
          placeholder="Say something…"
          maxLength={200}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Image size={16} className="text-gray-500 shrink-0" />
          <input
            type="url"
            className="input flex-1 text-sm py-1.5"
            placeholder="Image URL (optional)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {BG_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setBgColor(c)}
              className={`w-7 h-7 rounded-full border-2 ${bgColor === c ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={submit}
          disabled={loading || (!content.trim() && !imageUrl)}
          className="btn-primary w-full text-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Share story'}
        </button>
      </div>
    </div>
  );
}

function StoryViewer({ groups, initialGroup, currentUserId, onClose, onDeleted }) {
  const [gi, setGi] = useState(initialGroup);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const viewed = useRef(new Set());

  const group = groups[gi];
  const story = group?.stories[si];

  // Record the view once per story
  useEffect(() => {
    if (story && !viewed.current.has(story.id)) {
      viewed.current.add(story.id);
      api.post(`/stories/${story.id}/view`).catch(() => {});
    }
  }, [story]);

  // Progress timer
  useEffect(() => {
    if (!story || paused) return;
    const started = Date.now();
    const base = progress;
    const timer = setInterval(() => {
      const pct = base + ((Date.now() - started) / STORY_DURATION) * 100;
      if (pct >= 100) next();
      else setProgress(pct);
    }, 50);
    return () => clearInterval(timer);
  }, [gi, si, paused, story?.id]);

  const next = () => {
    setProgress(0);
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); }
    else onClose();
  };

  const prev = () => {
    setProgress(0);
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { setGi(gi - 1); setSi(groups[gi - 1].stories.length - 1); }
  };

  const deleteStory = async () => {
    if (!confirm('Delete this story?')) return;
    try {
      await api.delete(`/stories/${story.id}`);
      onDeleted();
      onClose();
    } catch {}
  };

  if (!story) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div
        className="relative w-full max-w-sm h-full max-h-[90vh] rounded-none sm:rounded-xl overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: story.bg_color || '#111827' }}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
      >
        {story.image_url && (
          <img src={story.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {story.content && (
          <p className="relative z-10 text-white text-xl font-semibold text-center break-words px-6 drop-shadow-lg">
            {story.content}
          </p>
        )}

        {/* Progress bars */}
        <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
          {group.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white"
                style={{ width: i < si ? '100%' : i === si ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-5 left-3 right-3 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            {group.user.avatar ? (
              <img src={group.user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold text-white">
                {group.user.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="text-white text-sm font-medium drop-shadow">{group.user.name}</div>
          </div>
          <div className="flex items-center gap-3">
            {group.user.id === currentUserId && (
              <>
                <span className="flex items-center gap-1 text-white/80 text-xs"><Eye size={13} /> {story.views_count}</span>
                <button onClick={deleteStory} className="text-white/80 hover:text-red-400"><Trash2 size={16} /></button>
              </>
            )}
            <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        {/* Nav zones */}
        <button onClick={prev} className="absolute left-0 top-0 h-full w-1/3 z-10" aria-label="Previous" />
        <button onClick={next} className="absolute right-0 top-0 h-full w-1/3 z-10" aria-label="Next" />
      </div>

      {/* Desktop arrows */}
      <button onClick={prev} className="hidden sm:block absolute left-4 text-white/60 hover:text-white z-20">
        <ChevronLeft size={32} />
      </button>
      <button onClick={next} className="hidden sm:block absolute right-4 text-white/60 hover:text-white z-20">
        <ChevronRight size={32} />
      </button>
    </div>
  );
}

export default function StoriesBar() {
  const { user } = useAuthStore();
  const [groups, setGroups] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingGroup, setViewingGroup] = useState(null);

  const fetchStories = async () => {
    try {
      const { data } = await api.get('/stories');
      setGroups(data.groups);
    } catch {
      setGroups([]);
    }
  };

  useEffect(() => { fetchStories(); }, []);

  // Real-time: refresh when anyone posts a new story
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNewStory = () => fetchStories();
    socket.on('new_story', onNewStory);
    return () => socket.off('new_story', onNewStory);
  }, []);

  const myGroup = groups.find((g) => g.user.id === user?.id);

  return (
    <div className="card p-3">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {/* Your story / add */}
        <div className="relative shrink-0">
          <StoryAvatar
            user={user}
            unviewed={myGroup ? !myGroup.all_viewed : false}
            label="Your story"
            onClick={() =>
              myGroup ? setViewingGroup(groups.indexOf(myGroup)) : setShowCreate(true)
            }
          />
          <button
            onClick={() => setShowCreate(true)}
            className="absolute bottom-5 right-1 w-5 h-5 bg-primary-500 hover:bg-primary-600 rounded-full flex items-center justify-center border-2 border-gray-900"
          >
            <Plus size={12} className="text-white" />
          </button>
        </div>

        {groups
          .filter((g) => g.user.id !== user?.id)
          .map((g) => (
            <StoryAvatar
              key={g.user.id}
              user={g.user}
              unviewed={!g.all_viewed}
              label={g.user.name?.split(' ')[0]}
              onClick={() => setViewingGroup(groups.indexOf(g))}
            />
          ))}
      </div>

      {showCreate && (
        <CreateStoryModal onClose={() => setShowCreate(false)} onCreated={fetchStories} />
      )}
      {viewingGroup !== null && groups[viewingGroup] && (
        <StoryViewer
          groups={groups}
          initialGroup={viewingGroup}
          currentUserId={user?.id}
          onClose={() => { setViewingGroup(null); fetchStories(); }}
          onDeleted={fetchStories}
        />
      )}
    </div>
  );
}
