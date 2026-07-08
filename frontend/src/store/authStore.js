import { create } from 'zustand';
import api from '../api/axios';
import { connectSocket, disconnectSocket } from '../lib/socket';

const stored = () => {
  try {
    const u = localStorage.getItem('shurma_user');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create((set, get) => ({
  user: stored(),
  token: localStorage.getItem('shurma_token') || null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('shurma_token', data.token);
      localStorage.setItem('shurma_user', JSON.stringify(data.user));
      connectSocket(data.token);
      set({ user: data.user, token: data.token, loading: false });
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  register: async (name, username, email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/register', { name, username, email, password });
      localStorage.setItem('shurma_token', data.token);
      localStorage.setItem('shurma_user', JSON.stringify(data.user));
      connectSocket(data.token);
      set({ user: data.user, token: data.token, loading: false });
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  logout: () => {
    localStorage.removeItem('shurma_token');
    localStorage.removeItem('shurma_user');
    disconnectSocket();
    set({ user: null, token: null });
  },

  updateUser: (updates) => {
    const user = { ...get().user, ...updates };
    localStorage.setItem('shurma_user', JSON.stringify(user));
    set({ user });
  },

  clearError: () => set({ error: null }),
}));
