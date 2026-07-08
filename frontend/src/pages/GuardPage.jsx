import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { Shield, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

const verdictConfig = {
  safe:    { icon: CheckCircle,   color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30' },
  flagged: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  blocked: { icon: XCircle,       color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30'       },
};

export default function GuardPage() {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [stats, setStats] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('check');

  useEffect(() => {
    fetchStats();
    if (user?.role === 'admin') fetchLogs();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/guard/stats');
      setStats(data.stats);
    } catch {}
  };

  const fetchLogs = async () => {
    try {
      const { data } = await api.get('/guard/logs');
      setLogs(data.logs);
    } catch {}
  };

  const checkContent = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setChecking(true);
    setResult(null);
    try {
      const { data } = await api.post('/guard/check', { content, content_type: 'text', source: 'manual' });
      setResult(data);
    } catch (err) {
      setResult({ verdict: 'error', reason: err.response?.data?.error || 'Check failed' });
    } finally { setChecking(false); }
  };

  const totalLogs = stats.reduce((sum, s) => sum + parseInt(s.count), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
          <Shield size={20} className="text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Content Guard</h1>
          <p className="text-sm text-gray-400">AI-powered content moderation</p>
        </div>
      </div>

      {/* Stats */}
      {stats.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {['safe', 'flagged', 'blocked'].map((v) => {
            const stat = stats.find((s) => s.verdict === v);
            const count = stat ? parseInt(stat.count) : 0;
            const cfg = verdictConfig[v];
            const Icon = cfg.icon;
            return (
              <div key={v} className={`card p-4 border ${cfg.bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className={cfg.color} />
                  <span className="text-xs font-medium capitalize text-gray-400">{v}</span>
                </div>
                <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
                {totalLogs > 0 && <p className="text-xs text-gray-600">{Math.round(count / totalLogs * 100)}%</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
        {['check', ...(user?.role === 'admin' ? ['logs'] : [])].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}
          >
            {t === 'check' ? 'Check Content' : 'Moderation Log'}
          </button>
        ))}
      </div>

      {tab === 'check' ? (
        <div className="card p-5 space-y-4">
          <form onSubmit={checkContent} className="space-y-3">
            <textarea
              rows={5}
              className="input resize-none"
              placeholder="Paste content to check for policy violations…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <button type="submit" disabled={checking || !content.trim()} className="btn-primary flex items-center gap-2">
              {checking ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              {checking ? 'Analyzing…' : 'Check Content'}
            </button>
          </form>

          {result && (() => {
            const cfg = verdictConfig[result.verdict] || verdictConfig.flagged;
            const Icon = cfg.icon;
            return (
              <div className={`border rounded-xl p-4 ${cfg.bg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={18} className={cfg.color} />
                  <span className={`font-semibold capitalize ${cfg.color}`}>{result.verdict}</span>
                  {result.score > 0 && (
                    <span className="ml-auto text-xs text-gray-500">Score: {(result.score * 100).toFixed(0)}%</span>
                  )}
                </div>
                <p className="text-sm text-gray-300">{result.reason}</p>
                {result.categories && Object.entries(result.categories).some(([, v]) => v) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(result.categories).filter(([, v]) => v).map(([k]) => (
                      <span key={k} className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full capitalize">{k}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No logs yet</p>
          ) : (
            logs.map((log) => {
              const cfg = verdictConfig[log.verdict] || verdictConfig.flagged;
              const Icon = cfg.icon;
              return (
                <div key={log.id} className={`card p-4 border ${cfg.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className={cfg.color} />
                    <span className={`text-xs font-semibold capitalize ${cfg.color}`}>{log.verdict}</span>
                    <span className="text-xs text-gray-600 ml-auto">
                      {log.name && `@${log.username} · `}
                      {new Date(log.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 truncate">{log.content}</p>
                  {log.reason && <p className="text-xs text-gray-500 mt-1">{log.reason}</p>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
