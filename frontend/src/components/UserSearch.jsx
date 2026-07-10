import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Search } from 'lucide-react';

export default function UserSearch({ className = '' }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  // Debounced search
  useEffect(() => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(q.trim())}`);
        setResults(data.users);
        setOpen(true);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (id) => {
    setOpen(false);
    setQ('');
    navigate(`/profile/${id}`);
  };

  return (
    <div className={`relative ${className}`} ref={boxRef}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      <input
        className="input pl-9 py-1.5 text-sm rounded-full bg-gray-800/80"
        placeholder="Search people…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.trim() && setOpen(true)}
      />
      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 card shadow-2xl z-50 overflow-hidden animate-slide-down">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">No users found</p>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                onClick={() => go(u.id)}
                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-800/60 transition-colors text-left"
              >
                {u.avatar ? (
                  <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold">
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">
                    {u.name} {u.is_verified && <span className="text-primary-400 text-xs">✓</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
