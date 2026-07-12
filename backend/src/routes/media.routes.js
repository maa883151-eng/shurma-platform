const express = require('express');
const router = express.Router();
const { getFile } = require('../services/media.service');

// Public, immutable media — URLs are only reachable via a random UUID.
router.get('/:id', async (req, res) => {
  try {
    const file = await getFile(req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    res.set('Content-Type', file.mime);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(file.content);
  } catch {
    // invalid UUIDs land here via the pg cast error
    res.status(404).json({ error: 'Not found' });
  }
});

module.exports = router;
