const pool = require('../config/db');
const { rankFeed } = require('../services/claude.service');

const getFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get posts from followed users + own posts
    const { rows: posts } = await pool.query(
      `SELECT p.*, u.name, u.username, u.avatar, u.is_verified,
              EXISTS(SELECT 1 FROM likes l WHERE l.user_id=$1 AND l.post_id=p.id) AS is_liked
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1
          OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id=$1)
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit * 2, offset]
    );

    if (posts.length === 0) {
      // Fallback: show recent public posts
      const { rows: recent } = await pool.query(
        `SELECT p.*, u.name, u.username, u.avatar, u.is_verified,
                EXISTS(SELECT 1 FROM likes l WHERE l.user_id=$1 AND l.post_id=p.id) AS is_liked
         FROM posts p JOIN users u ON u.id = p.user_id
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
    const now = Date.now();
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
      `SELECT p.*, u.name, u.username, u.avatar, u.is_verified
       FROM posts p JOIN users u ON u.id = p.user_id
       ORDER BY p.likes_count DESC, p.created_at DESC LIMIT 30`
    );
    res.json({ posts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getFeed, getExploreFeed };
