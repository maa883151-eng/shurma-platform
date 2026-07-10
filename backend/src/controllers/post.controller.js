const pool = require('../config/db');
const { moderateContent } = require('../services/claude.service');
const { POST_FIELDS, POST_JOIN } = require('../utils/postQuery');

const REACTIONS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

const extractHashtags = (text) =>
  [...new Set((text.match(/#([\p{L}\p{N}_]+)/gu) || []).map((t) => t.slice(1).toLowerCase()))];

const createPost = async (req, res) => {
  try {
    const { content, image_url, hashtags } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });

    const mod = await moderateContent(content);
    if (mod.verdict === 'blocked') {
      return res.status(422).json({ error: 'Content violates community guidelines', reason: mod.reason });
    }

    const tags = hashtags?.length ? hashtags : extractHashtags(content);
    const { rows } = await pool.query(
      `INSERT INTO posts (user_id, content, image_url, hashtags) VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [req.user.id, content.trim(), image_url || null, tags.length ? tags : null]
    );
    await pool.query('UPDATE users SET posts_count=posts_count+1 WHERE id=$1', [req.user.id]);

    const post = { ...rows[0], reactions: {}, author: { id: req.user.id, name: req.user.name, username: req.user.username, avatar: req.user.avatar } };

    const io = req.app.get('io');
    if (io) io.emit('new_post', post);

    res.status(201).json({ post });
  } catch (err) {
    console.error('createPost:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getPost = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${POST_FIELDS} ${POST_JOIN} WHERE p.id=$2`,
      [req.user.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserPosts = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${POST_FIELDS} ${POST_JOIN} WHERE p.user_id=$2 ORDER BY p.created_at DESC LIMIT 20`,
      [req.user.id, req.params.id]
    );
    res.json({ posts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT user_id FROM posts WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM posts WHERE id=$1', [req.params.id]);
    await pool.query('UPDATE users SET posts_count=GREATEST(posts_count-1,0) WHERE id=$1', [req.user.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ---- Reactions (Facebook-style) ----

const getReactionCounts = async (postId) => {
  const { rows } = await pool.query(
    'SELECT reaction, COUNT(*)::int AS cnt FROM likes WHERE post_id=$1 GROUP BY reaction',
    [postId]
  );
  return rows.reduce((acc, r) => ({ ...acc, [r.reaction]: r.cnt }), {});
};

const reactToPost = async (req, res) => {
  try {
    const reaction = REACTIONS.includes(req.body?.reaction) ? req.body.reaction : 'like';
    const { rows } = await pool.query(
      `INSERT INTO likes (user_id, post_id, reaction) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, post_id) DO UPDATE SET reaction=$3
       RETURNING (xmax = 0) AS inserted`,
      [req.user.id, req.params.id, reaction]
    );
    if (rows[0]?.inserted) {
      await pool.query('UPDATE posts SET likes_count=likes_count+1 WHERE id=$1', [req.params.id]);
    }
    res.json({ reaction, reactions: await getReactionCounts(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const removeReaction = async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM likes WHERE user_id=$1 AND post_id=$2', [req.user.id, req.params.id]);
    if (r.rowCount > 0) {
      await pool.query('UPDATE posts SET likes_count=GREATEST(likes_count-1,0) WHERE id=$1', [req.params.id]);
    }
    res.json({ reaction: null, reactions: await getReactionCounts(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Legacy endpoints — a plain like is just the 'like' reaction
const likePost = (req, res) => {
  req.body = { reaction: 'like' };
  return reactToPost(req, res);
};

const unlikePost = removeReaction;

// ---- Reposts / Quote posts (X-style) ----

const repostPost = async (req, res) => {
  try {
    const content = req.body?.content?.trim() || '';
    const { rows: origRows } = await pool.query('SELECT id, content, repost_of FROM posts WHERE id=$1', [req.params.id]);
    if (!origRows[0]) return res.status(404).json({ error: 'Post not found' });

    // Reposting a plain repost points at the root post instead
    const orig = origRows[0];
    const targetId = !orig.content && orig.repost_of ? orig.repost_of : orig.id;

    if (content) {
      const mod = await moderateContent(content);
      if (mod.verdict === 'blocked') {
        return res.status(422).json({ error: 'Content violates community guidelines', reason: mod.reason });
      }
    } else {
      // Plain repost: don't allow duplicates by the same user
      const { rows: dup } = await pool.query(
        `SELECT 1 FROM posts WHERE user_id=$1 AND repost_of=$2 AND content='' LIMIT 1`,
        [req.user.id, targetId]
      );
      if (dup[0]) return res.status(409).json({ error: 'Already reposted' });
    }

    const tags = extractHashtags(content);
    const { rows } = await pool.query(
      `INSERT INTO posts (user_id, content, repost_of, hashtags) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, content, targetId, tags.length ? tags : null]
    );
    await pool.query('UPDATE posts SET shares_count=shares_count+1 WHERE id=$1', [targetId]);
    await pool.query('UPDATE users SET posts_count=posts_count+1 WHERE id=$1', [req.user.id]);

    const { rows: full } = await pool.query(
      `SELECT ${POST_FIELDS} ${POST_JOIN} WHERE p.id=$2`,
      [req.user.id, rows[0].id]
    );

    const io = req.app.get('io');
    if (io) io.emit('new_post', full[0]);

    res.status(201).json({ post: full[0] });
  } catch (err) {
    console.error('repostPost:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ---- Bookmarks (X/Instagram-style saves) ----

const bookmarkPost = async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO bookmarks (user_id, post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.id]
    );
    res.json({ bookmarked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const unbookmarkPost = async (req, res) => {
  try {
    await pool.query('DELETE FROM bookmarks WHERE user_id=$1 AND post_id=$2', [req.user.id, req.params.id]);
    res.json({ bookmarked: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getBookmarks = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${POST_FIELDS} ${POST_JOIN}
       JOIN bookmarks bk ON bk.post_id = p.id AND bk.user_id = $1
       ORDER BY bk.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ posts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getComments = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.name, u.username, u.avatar FROM comments c
       JOIN users u ON u.id = c.user_id WHERE c.post_id=$1 ORDER BY c.created_at ASC LIMIT 50`,
      [req.params.id]
    );
    res.json({ comments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

    const { rows } = await pool.query(
      `INSERT INTO comments (user_id, post_id, content) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, req.params.id, content.trim()]
    );
    await pool.query('UPDATE posts SET comments_count=comments_count+1 WHERE id=$1', [req.params.id]);

    const comment = { ...rows[0], name: req.user.name, username: req.user.username, avatar: req.user.avatar };
    const io = req.app.get('io');
    if (io) io.to(`post:${req.params.id}`).emit('new_comment', comment);

    res.status(201).json({ comment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createPost, getPost, getUserPosts, deletePost,
  likePost, unlikePost, reactToPost, removeReaction,
  repostPost, bookmarkPost, unbookmarkPost, getBookmarks,
  getComments, addComment,
};
