import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import {
  MessageCircle, Repeat2, Trash2, Bookmark, PenLine, ThumbsUp,
  Loader2, X, Heart, ChevronLeft, ChevronRight, Clock,
} from 'lucide-react';
import VideoPlayer from '../../components/VideoPlayer';
import PollCard from '../../components/PollCard';

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
    <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line break-words">
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

function Avatar({ user, size = 'w-9 h-9', text = 'text-sm' }) {
  return user?.avatar ? (
    <img src={user.avatar} alt="" className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${size} rounded-full bg-primary-500 flex items-center justify-center ${text} font-bold shrink-0`}>
      {user?.name?.[0]?.toUpperCase()}
    </div>
  );
}

// Instagram-style multi-image carousel
function Carousel({ images, maxH = 'max-h-96' }) {
  const [idx, setIdx] = useState(0);
  if (!images?.length) return null;
  if (images.length === 1) {
    return <img src={images[0]} alt="" className={`rounded-lg ${maxH} w-full object-cover`} />;
  }
  return (
    <div className="relative rounded-lg overflow-hidden group/carousel">
      <img src={images[idx]} alt="" className={`${maxH} w-full object-cover`} />
      {idx > 0 && (
        <button
          onClick={() => setIdx(idx - 1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {idx < images.length - 1 && (
        <button
          onClick={() => setIdx(idx + 1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity"
        >
          <ChevronRight size={18} />
        </button>
      )}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded-full">
        {idx + 1}/{images.length}
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`}
          />
        ))}
      </div>
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
    <div className="border border-gray-800 rounded-lg p-3 space-y-2 hover:border-gray-700 transition-colors">
      <Link to={`/profile/${original.user_id}`} className="flex items-center gap-2 hover:opacity-80">
        <Avatar user={original} size="w-6 h-6" text="text-xs" />
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

// A single comment (recursive for replies, indent capped at one level)
function CommentNode({ comment, childrenMap, onReply, depth = 0 }) {
  const [liked, setLiked] = useState(comment.is_liked || false);
  const [likes, setLikes] = useState(comment.likes_count || 0);
  const replies = childrenMap[comment.id] || [];

  const toggleLike = async () => {
    try {
      if (liked) {
        await api.delete(`/posts/comments/${comment.id}/like`);
        setLiked(false);
        setLikes((c) => Math.max(0, c - 1));
      } else {
        await api.post(`/posts/comments/${comment.id}/like`);
        setLiked(true);
        setLikes((c) => c + 1);
      }
    } catch {}
  };

  return (
    <div className={depth > 0 ? 'ml-9' : ''}>
      <div className="flex gap-2 animate-fade-in">
        <Avatar user={comment} size="w-7 h-7" text="text-xs" />
        <div className="flex-1 min-w-0">
          <div className="bg-gray-800 rounded-2xl px-3 py-2 inline-block max-w-full">
            <span className="text-xs font-semibold text-gray-200">
              {comment.name}{comment.is_verified && <span className="text-primary-400"> ✓</span>}
            </span>
            <p className="text-xs text-gray-300 break-words">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 px-2">
            <span className="text-[11px] text-gray-500">{timeAgo(comment.created_at)}</span>
            <button
              onClick={toggleLike}
              className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
                liked ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
              }`}
            >
              <Heart size={11} fill={liked ? 'currentColor' : 'none'} />
              {likes > 0 && likes}
            </button>
            <button
              onClick={() => onReply(comment)}
              className="text-[11px] font-medium text-gray-500 hover:text-primary-400 transition-colors"
            >
              Reply
            </button>
          </div>
        </div>
      </div>
      {replies.map((r) => (
        <div key={r.id} className="mt-2">
          <CommentNode comment={r} childrenMap={childrenMap} onReply={onReply} depth={Math.min(depth + 1, 1)} />
        </div>
      ))}
    </div>
  );
}

export default function PostCard({ post, currentUserId, onRepost, onHashtag }) {
  const [myReaction, setMyReaction] = useState(post.my_reaction || (post.is_liked ? 'like' : null));
  const [reactions, setReactions] = useState(post.reactions || {});
  const [showPicker, setShowPicker] = useState(false);
  const [bookmarked, setBookmarked] = useState(post.is_bookmarked || false);
  const [watchLater, setWatchLater] = useState(post.in_watch_later || false);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [showQuoteBox, setShowQuoteBox] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [reposting, setReposting] = useState(false);
  const [sharesCount, setSharesCount] = useState(post.shares_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
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

  const toggleWatchLater = async () => {
    try {
      if (watchLater) {
        await api.delete(`/playlists/watch-later/${post.id}`);
        setWatchLater(false);
      } else {
        await api.post('/playlists/watch-later', { post_id: post.id });
        setWatchLater(true);
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
      try {
        const { data } = await api.get(`/posts/${post.id}/comments`);
        setComments(data.comments);
        setCommentsLoaded(true);
      } catch {}
    }
    setShowComments(!showComments);
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const { data } = await api.post(`/posts/${post.id}/comments`, {
        content: commentText,
        parent_id: replyTo?.id || undefined,
      });
      setComments((c) => [...c, data.comment]);
      setCommentsCount((c) => c + 1);
      setCommentText('');
      setReplyTo(null);
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
  const gallery = post.images?.length ? post.images : post.image_url ? [post.image_url] : [];

  // Build comment tree: top-level + replies grouped by parent
  const topLevel = comments.filter((c) => !c.parent_id);
  const childrenMap = comments.reduce((acc, c) => {
    if (c.parent_id) (acc[c.parent_id] = acc[c.parent_id] || []).push(c);
    return acc;
  }, {});

  return (
    <article className="card card-hover p-4 space-y-3 animate-slide-up">
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
          <button onClick={deletePost} className="text-gray-600 hover:text-red-400 transition-colors p-1">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Content */}
      {post.content && <RichContent text={post.content} onHashtag={onHashtag} />}
      {post.video_url && !post.repost_of && <VideoPlayer src={post.video_url} poster={gallery[0]} className="w-full" />}
      {!post.video_url && gallery.length > 0 && !post.repost_of && <Carousel images={gallery} />}
      {post.repost_of && <QuotedPost original={post.original_post} onHashtag={onHashtag} />}
      {post.poll_id && <PollCard poll={post.poll} postId={post.id} />}

      {/* Reaction summary */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="tracking-tighter">{topReactions.join('')}</span>
          <span>{totalReactions}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 border-t border-gray-800/60">
        {/* React (Facebook-style picker) */}
        <div
          className="relative flex-1"
          onMouseEnter={() => setShowPicker(true)}
          onMouseLeave={() => setShowPicker(false)}
        >
          {showPicker && (
            <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-gray-800 border border-gray-700 rounded-full px-2 py-1.5 shadow-xl z-10 animate-pop">
              {REACTIONS.map((r) => (
                <button
                  key={r.key}
                  title={r.label}
                  onClick={() => react(r.key)}
                  className={`text-xl leading-none hover:scale-125 hover:-translate-y-0.5 transition-transform ${
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
            className={`w-full flex items-center justify-center gap-1.5 text-sm py-2 mt-1 rounded-lg hover:bg-gray-800/60 transition-colors ${
              myReaction ? 'text-primary-400' : 'text-gray-500'
            }`}
          >
            {myEmoji ? <span className="text-base leading-none">{myEmoji}</span> : <ThumbsUp size={16} />}
            <span className="capitalize">{myReaction || 'React'}</span>
          </button>
        </div>

        {/* Comments */}
        <button
          onClick={toggleComments}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 mt-1 rounded-lg text-gray-500 hover:bg-gray-800/60 hover:text-primary-400 transition-colors"
        >
          <MessageCircle size={16} />
          <span>{commentsCount}</span>
        </button>

        {/* Repost (X-style) */}
        <div className="relative flex-1">
          {showRepostMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden w-36 animate-slide-down">
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
            className="w-full flex items-center justify-center gap-1.5 text-sm py-2 mt-1 rounded-lg text-gray-500 hover:bg-gray-800/60 hover:text-green-400 transition-colors"
          >
            <Repeat2 size={16} />
            <span>{sharesCount}</span>
          </button>
        </div>

        {/* Bookmark (X/IG-style save) */}
        <button
          onClick={toggleBookmark}
          className={`flex items-center justify-center py-2 px-2 mt-1 rounded-lg hover:bg-gray-800/60 transition-colors ${
            bookmarked ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'
          }`}
          title="Save"
        >
          <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} className={bookmarked ? 'animate-pop' : ''} />
        </button>

        {/* Watch Later (YouTube-style) */}
        {(post.video_url) && (
          <button
            onClick={toggleWatchLater}
            className={`flex items-center justify-center py-2 px-2 mt-1 rounded-lg hover:bg-gray-800/60 transition-colors ${
              watchLater ? 'text-primary-400' : 'text-gray-500 hover:text-primary-400'
            }`}
            title="Watch Later"
          >
            <Clock size={16} className={watchLater ? 'animate-pop' : ''} />
          </button>
        )}
      </div>

      {/* Quote composer */}
      {showQuoteBox && (
        <div className="space-y-2 border-t border-gray-800 pt-3 animate-fade-in">
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
        <div className="space-y-3 border-t border-gray-800 pt-3 animate-fade-in">
          {topLevel.map((c) => (
            <CommentNode key={c.id} comment={c} childrenMap={childrenMap} onReply={setReplyTo} />
          ))}
          {replyTo && (
            <div className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-400">
                Replying to <span className="font-semibold text-gray-200">{replyTo.name}</span>
              </span>
              <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-gray-300">
                <X size={13} />
              </button>
            </div>
          )}
          <form onSubmit={addComment} className="flex gap-2">
            <input
              className="input flex-1 text-sm py-1.5 rounded-full"
              placeholder={replyTo ? `Reply to ${replyTo.name}…` : 'Write a comment…'}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button type="submit" className="btn-primary text-sm px-4 py-1.5 rounded-full">Send</button>
          </form>
        </div>
      )}
    </article>
  );
}
