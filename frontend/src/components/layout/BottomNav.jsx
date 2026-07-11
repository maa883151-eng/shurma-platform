import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Home, MessageCircle, Tv2, ShoppingBag, User } from 'lucide-react';

export default function BottomNav() {
  const { user } = useAuthStore();

  const items = [
    { to: '/feed',    icon: Home,          label: 'Feed'     },
    { to: '/chats',   icon: MessageCircle, label: 'Chats'    },
    { to: '/channels',icon: Tv2,           label: 'Channels' },
    { to: '/shop',    icon: ShoppingBag,   label: 'Shop'     },
    { to: `/profile/${user?.id}`, icon: User, label: 'Profile' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur border-t border-gray-800 flex items-stretch pb-[env(safe-area-inset-bottom)]">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-primary-400' : 'text-gray-500 hover:text-gray-300'
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
