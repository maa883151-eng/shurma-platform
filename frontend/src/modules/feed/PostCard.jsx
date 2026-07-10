import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { MessageCircle, Repeat2, Trash2, Bookmark, PenLine, ThumbsUp, Loader2, X } from 'lucide-react';

const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'haha', emoji: '😂', label: 'Haha' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'angry', emoji: '😡', label: 'Angry' },
];
const EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.key, r.emoji]));

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// Render post text with clickable #hashtags
function RichContent({ text, onHashtag }) {
  const parts = String(text || '').split(/(#[\p{L}\p{N}_]+)/gu);
  return (
    <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line">
      {parts.map((part, i) =>
        part.startsWith('#') ? (
          <button
            key={i}
            onClick={() => onHashtag?.(part.slice(1).toLowerCase())}
            className="text-primary-400 hover:underline"
          >
            {part}
          </button>
        ) : (
          part
        )
      )}
    </p>
  );
}

function Avatar({ user, size = 'w-9 h-9' }) {
  return user?.avatar ? (
    <img src={user.avatar} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <div className={`${size} rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold`}>
      {user?.name?.[0]?.toUpperCase()}
    </div>
  );
}

// Embedded original post inside a repost / quote post
function QuotedPost({ original, onHashtag }) {
  if (!original) {
    return (
      <div className="border border-gray-800 rounded-lg p-3 text-sm text-gray-500">
        This post is unavailable
      </div>
    );
  }
  return (
    <div className="border border-gray-800 rounded-lg p-3 space-y-2">
      <Link to={`/profile/${original.user_id}`} className="flex items-center gap-2 hover:opacity-80">
        <Avatar user={original} size="w-6 h-6" />
        <span className="text-xs font-semibold text-gray-200">{original.name}</span>
        {original.is_verified && <span className="text-primary-400 text-xs">✓</span>}
        <span className="text-xs text-gray-500">@{original.username} · {timeAgo(original.created_at)}</span>
      </Link>
      <RichContent text={original.content} onHashtag={onHashtag} />
      {original.image_url && (
        <img src={original.image_url} alt="" className="rounded-lg max-h-60 w-full object-cover" />
      )}
    </div>
  );
}

export default function PostCard({ post, currentUserId, onRepost, onHashtag }) {
  const [myReaction, setMyReaction] = useState(post.my_reaction || (post.is_liked ? 'like' : null));
  const [reactions, setReactions] = useState(post.reactions || {});
  const [showPicker, setShowPicker] = useState(false);
  const [bookmarked, setBookmarked] = useState(post.is_bookmarked || false);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [showQuoteBox, setShowQuoteBox] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [reposting, setReposting] = useState(false);
  const [sharesCount, setSharesCount] = useState(post.shares_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);
  const topReactions = Object.entries(reactions)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => EMOJI[k]);

  const react = async (key) => {
    setShowPicker(false);
    try {
      const { data } =
        myReaction === key
          ? await api.delete(`/posts/${post.id}/react`)
          : await api.post(`/posts/${post.id}/react`, { reaction: key });
      setMyReaction(data.reaction);
      setReactions(data.reactions);
    } catch {}
  };

  const toggleBookmark = async () => {
    try {
      if (bookmarked) {
        await api.delete(`/posts/${post.id}/bookmark`);
        setBookmarked(false);
      } else {
        await api.post(`/posts/${post.id}/bookmark`);
        setBookmarked(true);
      }
    } catch {}
  };

  const doRepost = async (content) => {
    setReposting(true);
    try {
      const { data } = await api.post(`/posts/${post.id}/repost`, content ? { content } : {});
      setSharesCount((c) => c + 1);
      setShowRepostMenu(false);
      setShowQuoteBox(false);
      setQuoteText('');
      onRepost?.(data.post);
    } catch (err) {
      if (err.response?.status === 409) setShowRepostMenu(false);
    } finally {
      setReposting(false);
    }
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

  const isPlainRepost = post.repost_of && !post.content;
  const myEmoji = myReaction ? EMOJI[myReaction] : null;

  return (
    <div className="card p-4 space-y-3">
      {isPlainRepost && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 -mb-1">
          <Repeat2 size={13} />
          <span className="font-medium">{author.name}</span> reposted
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <Link to={`/profile/${author.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Avatar user={author} />
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
      {post.content && <RichContent text={post.content} onHashtag={onHashtag} />}
      {post.image_url && (
        <img src={post.image_url} alt="" className="rounded-lg max-h-80 w-full object-cover" />
      )}
      {post.repost_of && <QuotedPost original={post.original_post} onHashtag={onHashtag} />}

      {/* Reaction summary */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="tracking-tighter">{topReactions.join('')}</span>
          <span>{totalReactions}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-1 border-t border-gray-800/60">
        {/* React (Facebook-style picker) */}
        <div
          className="relative"
          onMouseEnter={() => setShowPicker(true)}
          onMouseLeave={() => setShowPicker(false)}
        >
          {showPicker && (
            <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-gray-800 border border-gray-700 rounded-full px-2 py-1.5 shadow-xl z-10">
              {REACTIONS.map((r) => (
                <button
                  key={r.key}
                  title={r.label}
                  onClick={() => react(r.key)}
                  className={`text-lg leading-none hover:scale-125 transition-transform ${
                    myReaction === r.key ? 'scale-110 bg-gray-700 rounded-full' : ''
                  }`}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => react(myReaction || 'like')}
            className={`flex items-center gap-1.5 text-sm pt-2 transition-colors ${
              myReaction ? 'text-primary-400' : 'text-gray-500 hover:text-primary-400'
            }`}
          >
            {myEmoji ? <span className="text-base leading-none">{myEmoji}</span> : <ThumbsUp size={16} />}
            <span className="capitalize">{myReaction || 'React'}</span>
          </button>
        </div>

        {/* Comments */}
        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-sm pt-2 text-gray-500 hover:text-primary-400 transition-colors"
        >
          <MessageCircle size={16} />
          <span>{post.comments_count}</span>
        </button>

        {/* Repost (X-style) */}
        <div className="relative">
          {showRepostMenu && (
            <div className="absolute bottom-full left-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden w-36">
              <button
                onClick={() => doRepost()}
                disabled={reposting}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
              >
                <Repeat2 size={14} /> Repost
              </button>
              <button
                onClick={() => { setShowRepostMenu(false); setShowQuoteBox(true); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
              >
                <PenLine size={14} /> Quote
              </button>
            </div>
          )}
          <button
            onClick={() => setShowRepostMenu(!showRepostMenu)}
            className="flex items-center gap-1.5 text-sm pt-2 text-gray-500 hover:text-green-400 transition-colors"
          >
            <Repeat2 size={16} />
            <span>{sharesCount}</span>
          </button>
        </div>

        {/* Bookmark (X/IG-style save) */}
        <button
          onClick={toggleBookmark}
          className={`ml-auto flex items-center pt-2 transition-colors ${
            bookmarked ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'
          }`}
        >
          <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Quote composer */}
      {showQuoteBox && (
        <div className="space-y-2 border-t border-gray-800 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Quote this post</span>
            <button onClick={() => setShowQuoteBox(false)} className="text-gray-500 hover:text-gray-300">
              <X size={14} />
            </button>
          </div>
          <textarea
            rows={2}
            autoFocus
            className="input resize-none text-sm"
            placeholder="Add your thoughts…"
            value={quoteText}
            onChange={(e) => setQuoteText(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              onClick={() => quoteText.trim() && doRepost(quoteText.trim())}
              disabled={reposting || !quoteText.trim()}
              className="btn-primary text-sm px-4 py-1.5"
            >
              {reposting ? <Loader2 size={16} className="animate-spin" /> : 'Quote'}
            </button>
          </div>
        </div>
      )}

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
