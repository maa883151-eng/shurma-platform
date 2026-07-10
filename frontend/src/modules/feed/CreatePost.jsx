import { useState, useRef } from 'react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { Image, Loader2, X, Hash, Plus } from 'lucide-react';

const MAX_IMAGES = 4;
const MAX_LEN = 500;

export default function CreatePost({ onPost }) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [imageInput, setImageInput] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef(null);

  const addImage = () => {
    const url = imageInput.trim();
    if (!url || images.length >= MAX_IMAGES) return;
    setImages((imgs) => [...imgs, url]);
    setImageInput('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/posts', {
        content: content.trim(),
        images: images.length ? images : undefined,
      });
      onPost?.(data.post);
      setContent('');
      setImages([]);
      setImageInput('');
      setShowImageInput(false);
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
        <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold shrink-0">
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
            }}
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
              <input
                type="url"
                className="input flex-1 text-sm py-1.5"
                placeholder={`Image URL (${images.length}/${MAX_IMAGES})…`}
                value={imageInput}
                onChange={(e) => setImageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addImage(); }
                }}
              />
              <button type="button" onClick={addImage} disabled={!imageInput.trim()} className="btn-ghost px-3 py-1.5 disabled:opacity-40">
                <Plus size={16} />
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-400 animate-fade-in">{error}</p>}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowImageInput(!showImageInput)}
                className={`p-2 rounded-lg transition-colors ${showImageInput ? 'text-primary-400 bg-primary-500/10' : 'text-gray-500 hover:text-primary-400 hover:bg-gray-800'}`}
                title="Add images"
              >
                <Image size={18} />
              </button>
              <button
                type="button"
                onClick={insertHashtag}
                className="p-2 rounded-lg text-gray-500 hover:text-primary-400 hover:bg-gray-800 transition-colors"
                title="Add hashtag"
              >
                <Hash size={18} />
              </button>
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
