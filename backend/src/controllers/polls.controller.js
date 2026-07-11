const pool = require('../config/db');

// Called internally from post.controller when creating a post with a poll
const createPoll = async (client, { question, options, is_multiple, is_anonymous, ends_at }) => {
  const { rows } = await client.query(
    `INSERT INTO polls (question, is_multiple, is_anonymous, ends_at) VALUES ($1,$2,$3,$4) RETURNING id`,
    [question, !!is_multiple, is_anonymous !== false, ends_at || null]
  );
  const pollId = rows[0].id;
  for (let i = 0; i < options.length; i++) {
    await client.query(
      'INSERT INTO poll_options (poll_id, text, position) VALUES ($1,$2,$3)',
      [pollId, options[i], i]
    );
  }
  return pollId;
};

const getPoll = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: pollRows } = await pool.query('SELECT * FROM polls WHERE id=$1', [id]);
    if (!pollRows[0]) return res.status(404).json({ error: 'Poll not found' });

    const { rows: options } = await pool.query(
      'SELECT * FROM poll_options WHERE poll_id=$1 ORDER BY position',
      [id]
    );

    const { rows: myVotes } = await pool.query(
      'SELECT option_id FROM poll_votes WHERE poll_id=$1 AND user_id=$2',
      [id, req.user.id]
    );

    const totalVotes = options.reduce((s, o) => s + parseInt(o.votes_count), 0);

    res.json({
      poll: {
        ...pollRows[0],
        options: options.map((o) => ({
          ...o,
          pct: totalVotes > 0 ? Math.round((o.votes_count / totalVotes) * 100) : 0,
        })),
        total_votes: totalVotes,
        my_votes: myVotes.map((v) => v.option_id),
        has_voted: myVotes.length > 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const votePoll = async (req, res) => {
  try {
    const { id } = req.params;
    const { option_ids } = req.body; // array of option UUIDs

    if (!option_ids?.length) return res.status(400).json({ error: 'option_ids required' });

    const { rows: pollRows } = await pool.query('SELECT * FROM polls WHERE id=$1', [id]);
    if (!pollRows[0]) return res.status(404).json({ error: 'Poll not found' });
    const poll = pollRows[0];

    if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
      return res.status(400).json({ error: 'Poll has ended' });
    }

    // Check existing vote
    const { rows: existing } = await pool.query(
      'SELECT option_id FROM poll_votes WHERE poll_id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    if (existing.length && !poll.is_multiple) {
      return res.status(409).json({ error: 'Already voted' });
    }

    const ids = poll.is_multiple ? option_ids : [option_ids[0]];

    for (const optId of ids) {
      const { rowCount } = await pool.query(
        'INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [id, optId, req.user.id]
      );
      if (rowCount > 0) {
        await pool.query('UPDATE poll_options SET votes_count=votes_count+1 WHERE id=$1', [optId]);
      }
    }

    // Return updated poll
    const { rows: options } = await pool.query(
      'SELECT * FROM poll_options WHERE poll_id=$1 ORDER BY position',
      [id]
    );
    const totalVotes = options.reduce((s, o) => s + parseInt(o.votes_count), 0);

    res.json({
      poll: {
        ...poll,
        options: options.map((o) => ({
          ...o,
          pct: totalVotes > 0 ? Math.round((o.votes_count / totalVotes) * 100) : 0,
        })),
        total_votes: totalVotes,
        my_votes: ids,
        has_voted: true,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createPoll, getPoll, votePoll };
