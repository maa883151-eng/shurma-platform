import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { connectSocket } from './lib/socket';

import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FeedPage from './pages/FeedPage';
import ChatPage from './pages/ChatPage';
import StreamPage from './pages/StreamPage';
import ShopPage from './pages/ShopPage';
import GuardPage from './pages/GuardPage';
import ProfilePage from './pages/ProfilePage';
import ChannelsPage from './pages/ChannelsPage';
import PlaylistsPage from './pages/PlaylistsPage';

function ProtectedRoute({ children }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { token } = useAuthStore();

  useEffect(() => {
    if (token) connectSocket(token);
  }, [token]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/feed" replace />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="chats" element={<ChatPage />} />
          <Route path="chats/:chatId" element={<ChatPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="channels/:handle" element={<ChannelsPage />} />
          <Route path="streams" element={<StreamPage />} />
          <Route path="streams/:streamId" element={<StreamPage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="shop/:slug" element={<ShopPage />} />
          <Route path="library" element={<PlaylistsPage />} />
          <Route path="guard" element={<GuardPage />} />
          <Route path="profile/:id" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
