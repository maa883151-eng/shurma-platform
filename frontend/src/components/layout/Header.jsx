import { useState } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Home, MessageCircle, Radio, ShoppingBag, Shield, Menu, X } from 'lucide-react';

const navItems = [
  { to: '/feed',    icon: Home,          label: 'Feed'    },
  { to: '/chats',   icon: MessageCircle, label: 'Chats'   },
  { to: '/streams', icon: Radio,         label: 'Streams' },
  { to: '/shop',    icon: ShoppingBag,   label: 'Shop'    },
  { to: '/guard',   icon: Shield,        label: 'Guard'   },
];

const titles = {
  '/feed':    'Feed',
  '/chats':   'Messages',
  '/streams': 'Live Streams',
  '/shop':    'Marketplace',
  '/guard':   'Content Guard',
};

export default function Header() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { logout } = useAuthStore();

  const title = Object.entries(titles).find(([path]) => location.pathname.startsWith(path))?.[1] || 'Shurma';

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between md:hidden sticky top-0 z-40">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <button onClick={() => setMenuOpen(!menuOpen)} className="text-gray-400 hover:text-white">
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-gray-900 border-b border-gray-800 p-4 space-y-1 z-50">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-500/20 text-primary-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 w-full text-red-400 hover:bg-gray-800 rounded-lg text-sm">
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
