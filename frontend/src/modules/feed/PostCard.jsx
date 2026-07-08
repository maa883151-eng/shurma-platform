import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { Heart, MessageCircle, Share2, Trash2 } from 'lucide-react';

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function PostCard({ post, currentUserId, onLikeToggle }) {
  const [liked, setLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  const toggleLike = async () => {
    try {
      if (liked) {
        await api.delete(`/posts/${post.id}/like`);
        setLiked(false);
        setLikesCount((c) => Math.max(0, c - 1));
        onLikeToggle?.(post.id, false);
      } else {
        await api.post(`/posts/${post.id}/like`);
        setLiked(true);
        setLikesCount((c) => c + 1);
        onLikeToggle?.(post.id, true);
      }
    } catch {}
  };

  const toggleComments = async () => {
    if (!commentsLoaded) {
      const { data } = await api.get(`/posts/${post.id}/comments`);
      setComments(data.comments);
      setCommentsLoaded(true);
    }
    setShowComments(!showComments);
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const { data } = await api.post(`/posts/${post.id}/comments`, { content: commentText });
      setComments((c) => [...c, data.comment]);
      setCommentText('');
    } catch {}
  };

  const deletePost = async () => {
    if (!confirm('Delete this post?')) return;
    try {
      await api.delete(`/posts/${post.id}`);
      window.location.reload();
    } catch {}
  };

  const author = {
    id: post.user_id,
    name: post.name,
    username: post.username,
    avatar: post.avatar,
    is_verified: post.is_verified,
  };

  return (
    <div className="card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <Link to={`/profile/${author.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          {author.avatar ? (
            <img src={author.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold">
              {author.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-gray-100">{author.name}</span>
              {author.is_verified && <span className="text-primary-400 text-xs">✓</span>}
            </div>
            <span className="text-xs text-gray-500">@{author.username} · {timeAgo(post.created_at)}</span>
          </div>
        </Link>
        {author.id === currentUserId && (
          <button onClick={deletePost} className="text-gray-600 hover:text-red-400 transition-colors">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line">{post.content}</p>
      {post.image_url && (
        <img src={post.image_url} alt="" className="rounded-lg max-h-80 w-full object-cover" />
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-1">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? 'text-red-400' : 'text-gray-500 hover:text-red-400'}`}
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          <span>{likesCount}</span>
        </button>
        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-400 transition-colors"
        >
          <MessageCircle size={16} />
          <span>{post.comments_count}</span>
        </button>
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-400 transition-colors">
          <Share2 size={16} />
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="space-y-3 border-t border-gray-800 pt-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs shrink-0">
                {c.name?.[0]?.toUpperCase()}
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-2 flex-1">
                <span className="text-xs font-medium text-gray-300">{c.name} </span>
                <span className="text-xs text-gray-400">{c.content}</span>
              </div>
            </div>
          ))}
          <form onSubmit={addComment} className="flex gap-2">
            <input
              className="input flex-1 text-sm py-1.5"
              placeholder="Write a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button type="submit" className="btn-primary text-sm px-3 py-1.5">Send</button>
          </form>
        </div>
      )}
    </div>
  );
}
