const pool = require('../config/db');
const { moderateContent } = require('../services/claude.service');

const checkContent = async (req, res) => {
  try {
    const { content, content_type = 'text', source = 'api' } = req.body;
    if (!content) return res.status(400).json({ error: 'content is required' });

    const result = await moderateContent(content, content_type);

    await pool.query(
      `INSERT INTO guard_logs (user_id, content, content_type, source, verdict, score, categories, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [req.user.id, content.slice(0, 2000), content_type, source, result.verdict, result.score, JSON.stringify(result.categories), result.reason]
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getLogs = async (req, res) => {
  try {
    const { verdict, limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '';
    const params = [parseInt(limit), offset];

    if (verdict) {
      where = 'WHERE verdict=$3';
      params.push(verdict);
    }

    const { rows } = await pool.query(
      `SELECT gl.*, u.name, u.username FROM guard_logs gl
       LEFT JOIN users u ON u.id=gl.user_id
       ${where}
       ORDER BY gl.created_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    res.json({ logs: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getRules = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM guard_rules WHERE is_active=TRUE ORDER BY created_at DESC'
    );
    res.json({ rules: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createRule = async (req, res) => {
  try {
    const { name, description, rule_type, rule_value, action } = req.body;
    if (!name || !rule_value) return res.status(400).json({ error: 'name and rule_value required' });

    const { rows } = await pool.query(
      `INSERT INTO guard_rules (name, description, rule_type, rule_value, action, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, description || null, rule_type || 'keyword', rule_value, action || 'flag', req.user.id]
    );
    res.status(201).json({ rule: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getStats = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT verdict, COUNT(*) AS count FROM guard_logs
       WHERE created_at > NOW() - INTERVAL '7 days'
       GROUP BY verdict`
    );
    res.json({ stats: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { checkContent, getLogs, getRules, createRule, getStats };
