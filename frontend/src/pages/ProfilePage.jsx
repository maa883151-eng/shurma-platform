import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import PostCard from '../modules/feed/PostCard';
import { UserCheck, UserPlus, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { id } = useParams();
  const { user: currentUser } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchPosts();
  }, [id]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/users/${id}`);
      setProfile(data.user);
      // Check if we follow them
      const { data: followerData } = await api.get(`/users/${id}/followers`);
      setFollowing(followerData.followers.some((f) => f.id === currentUser?.id));
    } finally { setLoading(false); }
  };

  const fetchPosts = async () => {
    try {
      const { data } = await api.get(`/posts/user/${id}`);
      setPosts(data.posts);
    } catch {}
  };

  const toggleFollow = async () => {
    try {
      if (following) {
        await api.delete(`/users/${id}/follow`);
        setFollowing(false);
        setProfile((p) => p ? { ...p, followers_count: Math.max(0, p.followers_count - 1) } : p);
      } else {
        await api.post(`/users/${id}/follow`);
        setFollowing(true);
        setProfile((p) => p ? { ...p, followers_count: p.followers_count + 1 } : p);
      }
    } catch {}
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-500" size={28} /></div>;
  if (!profile) return <div className="text-center py-16 text-gray-500">User not found</div>;

  const isOwn = currentUser?.id === id;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Profile card */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          {profile.avatar ? (
            <img src={profile.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-2xl font-bold shrink-0">
              {profile.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white">{profile.name}</h2>
              {profile.is_verified && <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full">Verified</span>}
            </div>
            <p className="text-gray-500 text-sm">@{profile.username}</p>
            {profile.bio && <p className="text-gray-300 text-sm mt-2 leading-relaxed">{profile.bio}</p>}
          </div>
          {!isOwn && (
            <button onClick={toggleFollow} className={following ? 'btn-ghost flex items-center gap-2 text-sm' : 'btn-primary flex items-center gap-2 text-sm'}>
              {following ? <><UserCheck size={15} /> Following</> : <><UserPlus size={15} /> Follow</>}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-800 text-center">
          <div>
            <p className="text-xl font-bold text-white">{profile.posts_count}</p>
            <p className="text-xs text-gray-500">Posts</p>
          </div>
          <div>
            <p className="text-xl font-bold text-white">{profile.followers_count}</p>
            <p className="text-xs text-gray-500">Followers</p>
          </div>
          <div>
            <p className="text-xl font-bold text-white">{profile.following_count}</p>
            <p className="text-xs text-gray-500">Following</p>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No posts yet</p>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={currentUser?.id} />
          ))
        )}
      </div>
    </div>
  );
}
