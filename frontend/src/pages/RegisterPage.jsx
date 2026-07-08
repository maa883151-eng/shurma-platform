import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Zap } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const { register, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    clearError();
    try {
      await register(form.name, form.username, form.email, form.password);
      navigate('/feed');
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Shurma</span>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-1">Create your account</h2>
          <p className="text-sm text-gray-400 mb-6">Anti-algorithmic. Verified. Yours.</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {[
              { key: 'name',     label: 'Full name',  type: 'text',     placeholder: 'Ahmed Al-Madani' },
              { key: 'username', label: 'Username',   type: 'text',     placeholder: 'ahmed.builds'    },
              { key: 'email',    label: 'Email',      type: 'email',    placeholder: 'you@example.com' },
              { key: 'password', label: 'Password',   type: 'password', placeholder: 'Min. 6 chars'   },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
                <input
                  type={type}
                  className="input"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  required
                />
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
