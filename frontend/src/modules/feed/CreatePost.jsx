import { useState, useRef } from 'react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { Image, Loader2, X } from 'lucide-react';

export default function CreatePost({ onPost }) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/posts', {
        content: content.trim(),
        image_url: imageUrl || undefined,
      });
      onPost?.(data.post);
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post');
    } finally {
      setLoading(false);
    }
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
        <form onSubmit={submit} className="flex-1 space-y-3">
          <textarea
            ref={textRef}
            rows={2}
            className="input resize-none"
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) submit(e);
            }}
          />
          {showImageInput && (
            <div className="flex gap-2">
              <input
                type="url"
                className="input flex-1 text-sm"
                placeholder="Paste image URL…"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
              <button type="button" onClick={() => { setShowImageInput(false); setImageUrl(''); }} className="text-gray-500 hover:text-gray-300">
                <X size={16} />
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowImageInput(!showImageInput)}
              className="text-gray-500 hover:text-primary-400 transition-colors"
            >
              <Image size={18} />
            </button>
            <button type="submit" disabled={loading || !content.trim()} className="btn-primary text-sm px-4 py-1.5">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
