const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

const register = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const exists = await pool.query('SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email or username already taken' });

    const hashed = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, username, email, password) VALUES ($1,$2,$3,$4)
       RETURNING id, name, username, email, avatar, bio, role, is_verified, is_streamer, created_at`,
      [name, username.toLowerCase(), email.toLowerCase(), hashed]
    );
    const token = signToken(rows[0].id);
    res.status(201).json({ user: rows[0], token });
  } catch (err) {
    console.error('register:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    if (!rows[0]) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { password: _, ...user } = rows[0];
    const token = signToken(user.id);
    res.json({ user, token });
  } catch (err) {
    console.error('login:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
};

const me = async (req, res) => {
  res.json({ user: req.user });
};

const demoLogin = async (req, res) => {
  try {
    const DEMO_EMAIL = 'demo@shurma.app';
    const DEMO_PASS = 'demo1234';
    const DEMO_NAME = 'Ahmed Al-Madani';
    const DEMO_USERNAME = 'ahmed_demo';

    let { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [DEMO_EMAIL]);

    if (!rows[0]) {
      const hashed = await bcrypt.hash(DEMO_PASS, 12);
      const insert = await pool.query(
        `INSERT INTO users (name, username, email, password, bio, is_verified)
         VALUES ($1,$2,$3,$4,$5,true)
         ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
         RETURNING *`,
        [DEMO_NAME, DEMO_USERNAME, DEMO_EMAIL, hashed, 'Demo account — explore all features of Shurma.']
      );
      rows = insert.rows;
    }

    const { password: _, ...user } = rows[0];
    const token = signToken(user.id);
    res.json({ user, token });
  } catch (err) {
    console.error('demoLogin:', err.message);
    res.status(500).json({ error: 'Demo login failed' });
  }
};

module.exports = { register, login, me, demoLogin };
