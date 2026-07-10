import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../lib/socket';
import PostCard from '../modules/feed/PostCard';
import CreatePost from '../modules/feed/CreatePost';
import StoriesBar from '../modules/feed/StoriesBar';
import { TrendingUp, X, ArrowUp } from 'lucide-react';

const TABS = [
  { key: 'feed', label: 'For You' },
  { key: 'explore', label: 'Explore' },
  { key: 'saved', label: 'Saved' },
];

function PostSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="skeleton w-9 h-9 rounded-full" />
        <div className="space-y-1.5">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-2.5 w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-4/5" />
        <div className="skeleton h-3 w-2/5" />
      </div>
      <div className="skeleton h-40 w-full" />
    </div>
  );
}

export default function FeedPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('feed');
  const [trending, setTrending] = useState([]);
  const [pending, setPending] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTag = searchParams.get('tag');
  const pendingRef = useRef([]);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      let endpoint = '/feed';
      if (activeTag) endpoint = `/feed/hashtag/${encodeURIComponent(activeTag)}`;
      else if (tab === 'explore') endpoint = '/feed/explore';
      else if (tab === 'saved') endpoint = '/posts/bookmarks/me';
      const { data } = await api.get(endpoint);
      setPosts(data.posts);
      setPending([]);
      pendingRef.current = [];
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFeed(); }, [tab, activeTag]);
  useEffect(() => {
    api.get('/feed/trending').then(({ data }) => setTrending(data.trending)).catch(() => {});
  }, []);

  // Real-time: queue new posts from others, show a "new posts" pill
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNewPost = (post) => {
      if (post.user_id === user?.id || post.author?.id === user?.id) return;
      pendingRef.current = [post, ...pendingRef.current];
      setPending([...pendingRef.current]);
    };
    socket.on('new_post', onNewPost);
    return () => socket.off('new_post', onNewPost);
  }, [user?.id]);

  const showPending = () => {
    setPosts((prev) => [...pendingRef.current, ...prev]);
    pendingRef.current = [];
    setPending([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onNewPost = (post) => setPosts((prev) => [post, ...prev]);
  const onHashtag = (tag) => setSearchParams({ tag });
  const clearTag = () => setSearchParams({});

  return (
    <div className="space-y-4">
      <StoriesBar />
      <CreatePost onPost={onNewPost} />

      {/* Trending hashtags (mobile/tablet — desktop shows them in the right rail) */}
      {trending.length > 0 && (
        <div className="flex xl:hidden items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          <TrendingUp size={15} className="text-primary-400 shrink-0" />
          {trending.map((t) => (
            <button
              key={t.tag}
              onClick={() => (activeTag === t.tag ? clearTag() : setSearchParams({ tag: t.tag }))}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeTag === t.tag
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-100'
              }`}
            >
              #{t.tag} <span className="opacity-60">· {t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Active hashtag banner */}
      {activeTag ? (
        <div className="flex items-center justify-between card px-4 py-2.5 animate-fade-in">
          <span className="text-sm text-gray-300">
            Posts tagged <span className="text-primary-400 font-semibold">#{activeTag}</span>
          </span>
          <button onClick={clearTag} className="text-gray-500 hover:text-gray-200">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 sticky top-14 z-30">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* New posts pill */}
      {pending.length > 0 && (
        <button
          onClick={showPending}
          className="mx-auto flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg animate-slide-down sticky top-28 z-30"
        >
          <ArrowUp size={13} />
          {pending.length} new {pending.length === 1 ? 'post' : 'posts'}
        </button>
      )}

      {loading ? (
        <div className="space-y-4">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-500 animate-fade-in">
          <p className="text-lg font-medium mb-2">
            {tab === 'saved' && !activeTag ? 'No saved posts' : 'No posts yet'}
          </p>
          <p className="text-sm">
            {tab === 'saved' && !activeTag
              ? 'Tap the bookmark icon on any post to save it here.'
              : 'Follow people or create your first post!'}
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user?.id}
            onRepost={onNewPost}
            onHashtag={onHashtag}
          />
        ))
      )}
    </div>
  );
}
