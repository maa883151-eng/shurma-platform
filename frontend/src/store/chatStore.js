import { create } from 'zustand';
import api from '../api/axios';

export const useChatStore = create((set, get) => ({
  chats: [],
  activeChat: null,
  messages: {},
  loading: false,

  fetchChats: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/chats');
      set({ chats: data.chats, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActiveChat: (chat) => set({ activeChat: chat }),

  fetchMessages: async (chatId) => {
    try {
      const { data } = await api.get(`/messages/${chatId}`);
      set((s) => ({ messages: { ...s.messages, [chatId]: data.messages } }));
    } catch {}
  },

  addMessage: (chatId, message) => {
    if (!message) return;
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: [...(s.messages[chatId] || []), message],
      },
      chats: s.chats.map((c) =>
        c.id === chatId ? { ...c, last_message: message.content, last_message_at: message.created_at } : c
      ),
    }));
  },

  // Merge a partial update (reactions, deleted flag, read state) into one message
  patchMessage: (chatId, messageId, patch) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, ...patch } : m
        ),
      },
    }));
  },

  // The other side read the chat — flip my sent messages to read (✓✓)
  markMessagesRead: (chatId) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: (s.messages[chatId] || []).map((m) => ({ ...m, is_read: true })),
      },
    }));
  },

  // I read the chat — persist server-side and clear the local unread badge
  markChatRead: async (chatId) => {
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, unread_count: 0 } : c)),
    }));
    try {
      await api.post(`/chats/${chatId}/read`);
    } catch {}
  },

  createChat: async (participantIds, name, is_group) => {
    const { data } = await api.post('/chats', { participantIds, name, is_group });
    set((s) => ({ chats: [data.chat, ...s.chats.filter((c) => c.id !== data.chat.id)] }));
    return data.chat;
  },
}));
