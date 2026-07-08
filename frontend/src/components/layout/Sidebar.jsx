import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Home, MessageCircle, Radio, ShoppingBag, Shield,
  User, LogOut, Zap
} from 'lucide-react';

const navItems = [
  { to: '/feed',    icon: Home,         label: 'Feed'      },
  { to: '/chats',   icon: MessageCircle, label: 'Chats'    },
  { to: '/streams', icon: Radio,         label: 'Streams'  },
  { to: '/shop',    icon: ShoppingBag,   label: 'Shop'     },
  { to: '/guard',   icon: Shield,        label: 'Guard'    },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-gray-900 border-r border-gray-800 p-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-2 mb-8">
        <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="text-xl font-bold text-white">Shurma</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-800 pt-4 space-y-2">
        <NavLink
          to={`/profile/${user?.id}`}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-100 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">@{user?.username}</p>
          </div>
        </NavLink>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-gray-500 hover:bg-gray-800 hover:text-red-400 transition-colors text-sm"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
