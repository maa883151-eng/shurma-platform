import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { getSocket } from '../lib/socket';
import { Bell, Heart, MessageCircle, Repeat2, UserPlus, PenLine } from 'lucide-react';

const REACTION_EMOJI = { like: '👍', love: '❤️', haha: '😂', wow: '😮', sad: '😢', angry: '😡' };

const ICONS = {
  reaction: { icon: Heart, color: 'text-red-400' },
  comment: { icon: MessageCircle, color: 'text-primary-400' },
  reply: { icon: MessageCircle, color: 'text-primary-400' },
  follow: { icon: UserPlus, color: 'text-green-400' },
  repost: { icon: Repeat2, color: 'text-green-400' },
  quote: { icon: PenLine, color: 'text-yellow-400' },
};

function label(n) {
  switch (n.type) {
    case 'reaction': return `reacted ${REACTION_EMOJI[n.meta?.reaction] || '👍'} to your post`;
    case 'comment': return `commented: "${n.meta?.preview || ''}"`;
    case 'reply': return `replied: "${n.meta?.preview || ''}"`;
    case 'follow': return 'started following you';
    case 'repost': return 'reposted your post';
    case 'quote': return 'quoted your post';
    default: return 'interacted with you';
  }
}

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    api.get('/notifications/unread-count').then(({ data }) => setUnread(data.count)).catch(() => {});
  }, []);

  // Real-time: new notifications arrive over the socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNotification = (n) => {
      setUnread((c) => c + 1);
      setItems((prev) => [n, ...prev].slice(0, 30));
    };
    socket.on('notification', onNotification);
    return () => socket.off('notification', onNotification);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const { data } = await api.get('/notifications');
        setItems(data.notifications);
        if (unread > 0) {
          await api.post('/notifications/read');
          setUnread(0);
        }
      } catch {} finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        className="relative p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pop">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] card shadow-2xl z-50 animate-slide-down overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 font-semibold text-sm text-gray-100">
            Notifications
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <div className="skeleton w-9 h-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-3/4" />
                      <div className="skeleton h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm">
                <Bell size={24} className="mx-auto mb-2 opacity-40" />
                Nothing yet — go make some noise!
              </div>
            ) : (
              items.map((n) => {
                const cfg = ICONS[n.type] || ICONS.reaction;
                const Icon = cfg.icon;
                return (
                  <Link
                    key={n.id}
                    to={n.type === 'follow' ? `/profile/${n.actor_id}` : '/feed'}
                    onClick={() => setOpen(false)}
                    className={`flex gap-3 px-4 py-3 hover:bg-gray-800/60 transition-colors ${!n.is_read ? 'bg-primary-500/5' : ''}`}
                  >
                    <div className="relative shrink-0">
                      {n.actor_avatar ? (
                        <img src={n.actor_avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold">
                          {n.actor_name?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className={`absolute -bottom-1 -right-1 bg-gray-900 rounded-full p-0.5 ${cfg.color}`}>
                        <Icon size={11} />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-300 leading-snug">
                        <span className="font-semibold text-gray-100">{n.actor_name}</span>{' '}
                        {label(n)}
                      </p>
                      <span className="text-[11px] text-gray-500">{timeAgo(n.created_at)}</span>
                    </div>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1.5" />}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
