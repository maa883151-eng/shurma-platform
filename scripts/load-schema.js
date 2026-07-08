// Run with: node scripts/load-schema.js
// Requires DATABASE_URL environment variable (or .env in backend/)
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function loadSchema() {
  const sql = fs.readFileSync(path.join(__dirname, '../backend/src/config/schema.sql'), 'utf8');
  console.log('Connecting to database…');
  const client = await pool.connect();
  try {
    console.log('Running schema…');
    await client.query(sql);
    console.log('✅ Schema loaded successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

loadSchema().catch((err) => {
  console.error('❌ Schema load failed:', err.message);
  process.exit(1);
});
