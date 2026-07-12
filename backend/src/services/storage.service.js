const crypto = require('crypto');

// Uploads go to Supabase Storage over its REST API — no SDK needed.
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and a public bucket
// (default "uploads"). Without them the endpoint reports 503 and the rest
// of the app keeps working with URL-based media.

const BUCKET = process.env.SUPABASE_BUCKET || 'uploads';

const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function validateImage(file) {
  if (!file) return 'No file provided';
  if (!ALLOWED_TYPES[file.mimetype]) {
    return `Unsupported file type ${file.mimetype} — allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB) — max 5 MB`;
  }
  return null;
}

function objectPath(userId, mimetype, folder = 'media') {
  const ext = ALLOWED_TYPES[mimetype];
  return `${folder}/${userId}/${crypto.randomUUID()}.${ext}`;
}

async function uploadBuffer(buffer, path, contentType) {
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
    body: buffer,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Storage upload failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

module.exports = { isConfigured, validateImage, objectPath, uploadBuffer, ALLOWED_TYPES, MAX_SIZE_BYTES };
