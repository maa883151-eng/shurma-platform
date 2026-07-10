import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { TrendingUp, UserPlus, UserCheck } from 'lucide-react';

function Suggestion({ user }) {
  const [following, setFollowing] = useState(false);

  const toggle = async () => {
    try {
      if (following) {
        await api.delete(`/users/${user.id}/follow`);
        setFollowing(false);
      } else {
        await api.post(`/users/${user.id}/follow`);
        setFollowing(true);
      }
    } catch {}
  };

  return (
    <div className="flex items-center gap-3">
      <Link to={`/profile/${user.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold shrink-0">
            {user.name?.[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-100 truncate">
            {user.name} {user.is_verified && <span className="text-primary-400 text-xs">✓</span>}
          </p>
          <p className="text-xs text-gray-500 truncate">@{user.username}</p>
        </div>
      </Link>
      <button
        onClick={toggle}
        className={`shrink-0 p-1.5 rounded-full transition-colors ${
          following ? 'text-green-400 bg-green-400/10' : 'text-primary-400 bg-primary-500/10 hover:bg-primary-500/20'
        }`}
        title={following ? 'Following' : 'Follow'}
      >
        {following ? <UserCheck size={15} /> : <UserPlus size={15} />}
      </button>
    </div>
  );
}

export default function RightRail() {
  const [trending, setTrending] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/feed/trending').then(({ data }) => setTrending(data.trending)).catch(() => {});
    api.get('/users/suggestions').then(({ data }) => setSuggestions(data.users)).catch(() => {});
  }, []);

  return (
    <aside className="hidden xl:block w-80 shrink-0 overflow-y-auto py-6 pr-4">
      {/* Trending */}
      <div className="card p-4 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-100">
          <TrendingUp size={15} className="text-primary-400" /> Trending
        </h3>
        {trending.length === 0 ? (
          <p className="text-xs text-gray-500">No trends yet — start a hashtag!</p>
        ) : (
          trending.slice(0, 6).map((t, i) => (
            <button
              key={t.tag}
              onClick={() => navigate(`/feed?tag=${encodeURIComponent(t.tag)}`)}
              className="block w-full text-left group"
            >
              <p className="text-[11px] text-gray-500">#{i + 1} · Trending</p>
              <p className="text-sm font-semibold text-gray-100 group-hover:text-primary-400 transition-colors">
                #{t.tag}
              </p>
              <p className="text-[11px] text-gray-500">{t.count} {t.count === 1 ? 'post' : 'posts'}</p>
            </button>
          ))
        )}

        {/* Who to follow */}
        {suggestions.length > 0 && (
          <>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-100 pt-3 border-t border-gray-800">
              <UserPlus size={15} className="text-primary-400" /> Who to follow
            </h3>
            {suggestions.map((u) => <Suggestion key={u.id} user={u} />)}
          </>
        )}
      </div>
    </aside>
  );
}
