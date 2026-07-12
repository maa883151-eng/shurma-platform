import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { uploadFile } from '../api/upload';
import { useAuthStore } from '../store/authStore';
import PostCard from '../modules/feed/PostCard';
import { UserCheck, UserPlus, Pencil, X, Loader2, CalendarDays, Camera } from 'lucide-react';

function EditProfileModal({ profile, onClose, onSaved }) {
  const [name, setName] = useState(profile.name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatar, setAvatar] = useState(profile.avatar || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      setAvatar(await uploadFile(file, 'avatar'));
    } catch (err) {
      setError(err.response?.status === 503
        ? 'Uploads not configured — paste an image URL below instead'
        : err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/users/profile', {
        name: name.trim() || undefined,
        bio,
        avatar: avatar.trim() || undefined,
      });
      onSaved(data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <form onSubmit={save} className="card p-5 w-full max-w-sm space-y-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-100">Edit profile</h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>

        <div className="flex justify-center">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={pickAvatar} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="relative group rounded-full" title="Upload photo">
            {avatar ? (
              <img src={avatar} alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-primary-500" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center text-3xl font-bold ring-2 ring-primary-400">
                {name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? <Loader2 size={20} className="animate-spin text-white" /> : <Camera size={20} className="text-white" />}
            </span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Name</label>
            <input className="input text-sm" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Bio</label>
            <textarea className="input text-sm resize-none" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} placeholder="Tell people about yourself…" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Avatar URL</label>
            <input type="url" className="input text-sm" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary w-full text-sm">
          {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Save changes'}
        </button>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  const { id } = useParams();
  const { user: currentUser, updateUser } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchPosts();
  }, [id]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/users/${id}`);
      setProfile(data.user);
      setFollowing(data.user.is_following || false);
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

  const onProfileSaved = (updated) => {
    setProfile((p) => ({ ...p, ...updated }));
    if (isOwn) updateUser(updated);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card overflow-hidden">
          <div className="skeleton h-28 rounded-none" />
          <div className="p-5 space-y-3">
            <div className="skeleton w-20 h-20 rounded-full -mt-14 border-4 border-gray-900" />
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-24" />
          </div>
        </div>
      </div>
    );
  }
  if (!profile) return <div className="text-center py-16 text-gray-500">User not found</div>;

  const isOwn = currentUser?.id === id;
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Profile card with cover */}
      <div className="card overflow-hidden animate-slide-up">
        <div className="h-28 bg-gradient-to-r from-primary-700 via-primary-500 to-pink-500" />
        <div className="p-5">
          <div className="flex items-end justify-between -mt-14 mb-3">
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-gray-900" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center text-3xl font-bold border-4 border-gray-900">
                {profile.name?.[0]?.toUpperCase()}
              </div>
            )}
            {isOwn ? (
              <button onClick={() => setEditing(true)} className="btn-ghost flex items-center gap-2 text-sm border border-gray-700">
                <Pencil size={14} /> Edit profile
              </button>
            ) : (
              <button onClick={toggleFollow} className={following ? 'btn-ghost flex items-center gap-2 text-sm border border-gray-700' : 'btn-primary flex items-center gap-2 text-sm'}>
                {following ? <><UserCheck size={15} /> Following</> : <><UserPlus size={15} /> Follow</>}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-white">{profile.name}</h2>
            {profile.is_verified && <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full">✓ Verified</span>}
            {profile.is_streamer && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">● Streamer</span>}
          </div>
          <p className="text-gray-500 text-sm">@{profile.username}</p>
          {profile.bio && <p className="text-gray-300 text-sm mt-2 leading-relaxed">{profile.bio}</p>}
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
            <CalendarDays size={13} /> Joined {joined}
          </p>

          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-800 text-center">
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

      {editing && (
        <EditProfileModal profile={profile} onClose={() => setEditing(false)} onSaved={onProfileSaved} />
      )}
    </div>
  );
}
