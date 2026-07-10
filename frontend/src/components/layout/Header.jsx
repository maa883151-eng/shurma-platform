import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import NotificationBell from '../NotificationBell';
import UserSearch from '../UserSearch';
import { Zap, Search, X } from 'lucide-react';

const titles = {
  '/feed':    'Feed',
  '/chats':   'Messages',
  '/streams': 'Live Streams',
  '/shop':    'Marketplace',
  '/guard':   'Content Guard',
  '/profile': 'Profile',
};

export default function Header() {
  const location = useLocation();
  const { user } = useAuthStore();
  const [mobileSearch, setMobileSearch] = useState(false);

  const title = Object.entries(titles).find(([path]) => location.pathname.startsWith(path))?.[1] || 'Shurma';

  return (
    <header className="bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-2.5 flex items-center gap-3 sticky top-0 z-40">
      {/* Mobile logo / desktop title */}
      <Link to="/feed" className="flex items-center gap-2 md:hidden shrink-0">
        <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        {!mobileSearch && <span className="font-bold text-white">Shurma</span>}
      </Link>
      <h1 className="hidden md:block text-lg font-semibold text-white shrink-0">{title}</h1>

      {/* Search: inline on md+, expandable on mobile */}
      <div className="flex-1 flex justify-end md:justify-center min-w-0">
        <UserSearch className="hidden md:block w-full max-w-sm" />
        {mobileSearch && <UserSearch className="md:hidden flex-1 animate-fade-in" />}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setMobileSearch(!mobileSearch)}
          className="md:hidden p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          aria-label="Search"
        >
          {mobileSearch ? <X size={20} /> : <Search size={20} />}
        </button>
        <NotificationBell />
        <Link to={`/profile/${user?.id}`} className="hidden md:block ml-1">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-transparent hover:ring-primary-500 transition-all" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold ring-2 ring-transparent hover:ring-primary-400 transition-all">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          )}
        </Link>
      </div>
    </header>
  );
}
