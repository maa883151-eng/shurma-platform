const pool = require('../config/db');

// Database-backed media store — the zero-config upload path. Files live in
// a bytea column and are served from /api/media/:id. Fine at portfolio
// scale (5 MB cap per file); Supabase Storage takes over automatically
// when SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are set.

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      mime VARCHAR(100) NOT NULL,
      file_name VARCHAR(255),
      content BYTEA NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function saveFile({ userId, mime, fileName, buffer }) {
  const { rows } = await pool.query(
    'INSERT INTO media_files (user_id, mime, file_name, content) VALUES ($1,$2,$3,$4) RETURNING id',
    [userId, mime, fileName || null, buffer]
  );
  return rows[0].id;
}

async function getFile(id) {
  const { rows } = await pool.query('SELECT mime, content FROM media_files WHERE id=$1', [id]);
  return rows[0] || null;
}

module.exports = { ensureTable, saveFile, getFile };
