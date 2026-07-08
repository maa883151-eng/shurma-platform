import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import PostCard from '../modules/feed/PostCard';
import CreatePost from '../modules/feed/CreatePost';
import { Loader2 } from 'lucide-react';

export default function FeedPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('feed');

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const endpoint = tab === 'feed' ? '/feed' : '/feed/explore';
      const { data } = await api.get(endpoint);
      setPosts(data.posts);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFeed(); }, [tab]);

  const onNewPost = (post) => setPosts((prev) => [post, ...prev]);
  const onLikeToggle = (postId, liked) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, is_liked: liked, likes_count: p.likes_count + (liked ? 1 : -1) }
          : p
      )
    );
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <CreatePost onPost={onNewPost} />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
        {['feed', 'explore'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-gray-100'
            }`}
          >
            {t === 'feed' ? 'For You' : 'Explore'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary-500" size={28} />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium mb-2">No posts yet</p>
          <p className="text-sm">Follow people or create your first post!</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post} currentUserId={user?.id} onLikeToggle={onLikeToggle} />
        ))
      )}
    </div>
  );
}
