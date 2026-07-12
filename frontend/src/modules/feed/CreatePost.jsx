import { useState, useRef } from 'react';
import api from '../../api/axios';
import { uploadFile } from '../../api/upload';
import { useAuthStore } from '../../store/authStore';
import { Image, Loader2, X, Hash, Plus, Video, BarChart3, Link as LinkIcon } from 'lucide-react';

const MAX_IMAGES = 4;
const MAX_LEN = 500;

function PollBuilder({ poll, onChange, onRemove }) {
  const addOption = () => {
    if (poll.options.length >= 6) return;
    onChange({ ...poll, options: [...poll.options, ''] });
  };
  const setOption = (i, val) => {
    const opts = [...poll.options];
    opts[i] = val;
    onChange({ ...poll, options: opts });
  };
  const removeOption = (i) => {
    if (poll.options.length <= 2) return;
    onChange({ ...poll, options: poll.options.filter((_, j) => j !== i) });
  };

  return (
    <div className="border border-primary-500/40 rounded-xl p-3 space-y-2 bg-primary-500/5 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-primary-400 flex items-center gap-1"><BarChart3 size={12} /> Poll</span>
        <button type="button" onClick={onRemove} className="text-gray-500 hover:text-red-400"><X size={14} /></button>
      </div>
      <input className="input text-sm" placeholder="Poll question…" required value={poll.question}
        onChange={(e) => onChange({ ...poll, question: e.target.value })} />
      {poll.options.map((opt, i) => (
        <div key={i} className="flex gap-2">
          <input className="input text-sm flex-1 py-1.5" placeholder={`Option ${i + 1}`}
            value={opt} onChange={(e) => setOption(i, e.target.value)} />
          {poll.options.length > 2 && (
            <button type="button" onClick={() => removeOption(i)} className="text-gray-500 hover:text-red-400"><X size={14} /></button>
          )}
        </div>
      ))}
      {poll.options.length < 6 && (
        <button type="button" onClick={addOption} className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
          <Plus size={11} /> Add option
        </button>
      )}
      <div className="flex gap-3 text-xs text-gray-500">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={poll.is_multiple} onChange={(e) => onChange({ ...poll, is_multiple: e.target.checked })} />
          Multiple choice
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={poll.is_anonymous} onChange={(e) => onChange({ ...poll, is_anonymous: e.target.checked })} />
          Anonymous
        </label>
      </div>
    </div>
  );
}

export default function CreatePost({ onPost }) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [imageInput, setImageInput] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef(null);
  const fileRef = useRef(null);

  const addImage = () => {
    const url = imageInput.trim();
    if (!url || images.length >= MAX_IMAGES) return;
    setImages((imgs) => [...imgs, url]);
    setImageInput('');
  };

  const pickImages = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_IMAGES - images.length);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const urls = await Promise.all(files.map((f) => uploadFile(f, 'post')));
      setImages((imgs) => [...imgs, ...urls].slice(0, MAX_IMAGES));
    } catch (err) {
      if (err.response?.status === 503) {
        setShowImageInput(true);
        setError('Uploads not configured — paste an image URL instead');
      } else {
        setError(err.response?.data?.error || 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const addPoll = () => {
    setPoll({ question: '', options: ['', ''], is_multiple: false, is_anonymous: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    // Validate poll
    if (poll) {
      if (!poll.question.trim()) return setError('Poll question required');
      if (poll.options.filter((o) => o.trim()).length < 2) return setError('Poll needs at least 2 options');
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        content: content.trim(),
        images: images.length ? images : undefined,
        video_url: videoUrl.trim() || undefined,
        poll: poll ? { ...poll, options: poll.options.filter((o) => o.trim()) } : undefined,
      };
      const { data } = await api.post('/posts', payload);
      onPost?.(data.post);
      setContent('');
      setImages([]);
      setImageInput('');
      setVideoUrl('');
      setShowImageInput(false);
      setShowVideoInput(false);
      setPoll(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post');
    } finally {
      setLoading(false);
    }
  };

  const insertHashtag = () => {
    setContent((c) => (c.endsWith(' ') || c === '' ? `${c}#` : `${c} #`));
    textRef.current?.focus();
  };

  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            user?.name?.[0]?.toUpperCase()
          )}
        </div>
        <form onSubmit={submit} className="flex-1 space-y-3 min-w-0">
          <textarea
            ref={textRef}
            rows={2}
            maxLength={MAX_LEN}
            className="input resize-none"
            placeholder={`What's on your mind, ${user?.name?.split(' ')[0] || 'there'}?`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }}
          />

          {/* Image previews */}
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((url, i) => (
                <div key={i} className="relative group animate-pop">
                  <img src={url} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-700" />
                  <button
                    type="button"
                    onClick={() => setImages((imgs) => imgs.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showImageInput && images.length < MAX_IMAGES && (
            <div className="flex gap-2 animate-fade-in">
              <input type="url" className="input flex-1 text-sm py-1.5"
                placeholder={`Image URL (${images.length}/${MAX_IMAGES})…`}
                value={imageInput} onChange={(e) => setImageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImage(); } }} />
              <button type="button" onClick={addImage} disabled={!imageInput.trim()} className="btn-ghost px-3 py-1.5 disabled:opacity-40">
                <Plus size={16} />
              </button>
            </div>
          )}

          {showVideoInput && (
            <div className="flex gap-2 animate-fade-in">
              <Video size={15} className="text-gray-500 shrink-0 mt-2.5" />
              <input type="url" className="input flex-1 text-sm py-1.5"
                placeholder="YouTube / Vimeo / direct video URL…"
                value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
              {videoUrl && (
                <button type="button" onClick={() => { setVideoUrl(''); setShowVideoInput(false); }} className="text-gray-500 hover:text-red-400 mt-2">
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {poll && (
            <PollBuilder poll={poll} onChange={setPoll} onRemove={() => setPoll(null)} />
          )}

          {error && <p className="text-xs text-red-400 animate-fade-in">{error}</p>}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple
                className="hidden" onChange={pickImages} />
              <button type="button" onClick={() => fileRef.current?.click()}
                disabled={uploading || images.length >= MAX_IMAGES}
                className={`p-2 rounded-lg transition-colors ${uploading ? 'text-primary-400 bg-primary-500/10' : 'text-gray-500 hover:text-primary-400 hover:bg-gray-800'} disabled:opacity-40`}
                title="Upload photos">
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Image size={18} />}
              </button>
              <button type="button" onClick={() => setShowImageInput(!showImageInput)}
                className={`p-2 rounded-lg transition-colors ${showImageInput ? 'text-primary-400 bg-primary-500/10' : 'text-gray-500 hover:text-primary-400 hover:bg-gray-800'}`}
                title="Add image by URL">
                <LinkIcon size={18} />
              </button>
              <button type="button" onClick={() => setShowVideoInput(!showVideoInput)}
                className={`p-2 rounded-lg transition-colors ${(showVideoInput || videoUrl) ? 'text-primary-400 bg-primary-500/10' : 'text-gray-500 hover:text-primary-400 hover:bg-gray-800'}`}
                title="Add video">
                <Video size={18} />
              </button>
              <button type="button" onClick={insertHashtag}
                className="p-2 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-gray-800 transition-colors"
                title="Add hashtag">
                <Hash size={18} />
              </button>
              {!poll && (
                <button type="button" onClick={addPoll}
                  className="p-2 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-gray-800 transition-colors"
                  title="Add poll">
                  <BarChart3 size={18} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {content.length > 0 && (
                <span className={`text-[11px] ${content.length > MAX_LEN - 50 ? 'text-yellow-400' : 'text-gray-600'}`}>
                  {content.length}/{MAX_LEN}
                </span>
              )}
              <button type="submit" disabled={loading || !content.trim()} className="btn-primary text-sm px-5 py-1.5">
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Post'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
