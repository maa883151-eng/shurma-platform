import api from './axios';

// Upload a File/Blob to /api/upload; resolves to its public URL.
// folder: 'avatar' | 'post' | 'chat' | 'product' | 'media'
export async function uploadFile(file, folder = 'media') {
  const form = new FormData();
  form.append('file', file);
  form.append('folder', folder);
  const { data } = await api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}
