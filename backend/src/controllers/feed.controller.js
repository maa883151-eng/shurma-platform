const pool = require('../config/db');
const { rankFeed } = require('../services/claude.service');
const { POST_FIELDS, POST_JOIN } = require('../utils/postQuery');

const getFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get posts from followed users + own posts
    const { rows: posts } = await pool.query(
      `SELECT ${POST_FIELDS} ${POST_JOIN}
       WHERE p.user_id = $1
          OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id=$1)
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit * 2, offset]
    );

    if (posts.length === 0) {
      // Fallback: show recent public posts
      const { rows: recent } = await pool.query(
        `SELECT ${POST_FIELDS} ${POST_JOIN}
         ORDER BY p.created_at DESC LIMIT $2`,
        [userId, limit]
      );
      return res.json({ posts: recent, ranked: false });
    }

    const scores = await rankFeed(posts, `user ${userId}`);
    const scoreMap = {};
    scores.forEach(s => { scoreMap[s.postId] = s.score; });

    const ranked = [...posts]
      .sort((a, b) => (scoreMap[b.id] || 0) - (scoreMap[a.id] || 0))
      .slice(0, limit);

    // Persist feed scores asynchronously
    ranked.forEach(p => {
      pool.query(
        `INSERT INTO feed_scores (user_id, post_id, score, reason) VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id, post_id) DO UPDATE SET score=$3, reason=$4, created_at=NOW()`,
        [userId, p.id, scoreMap[p.id] || 0, 'ai-ranked']
      ).catch(() => {});
    });

    res.json({ posts: ranked, ranked: true });
  } catch (err) {
    console.error('getFeed:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getExploreFeed = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${POST_FIELDS} ${POST_JOIN}
       ORDER BY p.likes_count DESC, p.created_at DESC LIMIT 30`,
      [req.user.id]
    );
    res.json({ posts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Trending hashtags over the last 7 days (X-style)
const getTrending = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT LOWER(tag) AS tag, COUNT(*)::int AS count
       FROM posts p, unnest(p.hashtags) AS tag
       WHERE p.created_at > NOW() - INTERVAL '7 days'
       GROUP BY LOWER(tag)
       ORDER BY count DESC, tag ASC
       LIMIT 10`
    );
    res.json({ trending: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Posts for a single hashtag
const getHashtagFeed = async (req, res) => {
  try {
    const tag = req.params.tag.toLowerCase();
    const { rows } = await pool.query(
      `SELECT ${POST_FIELDS} ${POST_JOIN}
       WHERE $2 = ANY(p.hashtags)
       ORDER BY p.created_at DESC LIMIT 30`,
      [req.user.id, tag]
    );
    res.json({ posts: rows, tag });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getFeed, getExploreFeed, getTrending, getHashtagFeed };
