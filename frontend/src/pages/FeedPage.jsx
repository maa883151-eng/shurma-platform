import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import PostCard from '../modules/feed/PostCard';
import CreatePost from '../modules/feed/CreatePost';
import StoriesBar from '../modules/feed/StoriesBar';
import { Loader2, TrendingUp, X } from 'lucide-react';

const TABS = [
  { key: 'feed', label: 'For You' },
  { key: 'explore', label: 'Explore' },
  { key: 'saved', label: 'Saved' },
];

export default function FeedPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('feed');
  const [trending, setTrending] = useState([]);
  const [activeTag, setActiveTag] = useState(null);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      let endpoint = '/feed';
      if (activeTag) endpoint = `/feed/hashtag/${encodeURIComponent(activeTag)}`;
      else if (tab === 'explore') endpoint = '/feed/explore';
      else if (tab === 'saved') endpoint = '/posts/bookmarks/me';
      const { data } = await api.get(endpoint);
      setPosts(data.posts);
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

  const onNewPost = (post) => setPosts((prev) => [post, ...prev]);
  const onHashtag = (tag) => { setActiveTag(tag); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <StoriesBar />
      <CreatePost onPost={onNewPost} />

      {/* Trending hashtags */}
      {trending.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <TrendingUp size={15} className="text-primary-400 shrink-0" />
          {trending.map((t) => (
            <button
              key={t.tag}
              onClick={() => setActiveTag(activeTag === t.tag ? null : t.tag)}
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
        <div className="flex items-center justify-between card px-4 py-2.5">
          <span className="text-sm text-gray-300">
            Posts tagged <span className="text-primary-400 font-semibold">#{activeTag}</span>
          </span>
          <button onClick={() => setActiveTag(null)} className="text-gray-500 hover:text-gray-200">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary-500" size={28} />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
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
