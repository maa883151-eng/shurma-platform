const express = require('express');
const multer = require('multer');
const router = express.Router();
const { auth } = require('../middleware/auth');
const storage = require('../services/storage.service');
const media = require('../services/media.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: storage.MAX_SIZE_BYTES },
});

// POST /api/upload — multipart field "file"; returns { url }.
// Uses Supabase Storage when configured, otherwise stores in Postgres
// and serves from /api/media/:id — uploads work with zero extra config.
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    const invalid = storage.validateImage(req.file);
    if (invalid) return res.status(400).json({ error: invalid });

    if (storage.isConfigured()) {
      const folder = ['avatar', 'post', 'chat', 'product'].includes(req.body.folder)
        ? req.body.folder
        : 'media';
      const path = storage.objectPath(req.user.id, req.file.mimetype, folder);
      const url = await storage.uploadBuffer(req.file.buffer, path, req.file.mimetype);
      return res.status(201).json({ url });
    }

    const id = await media.saveFile({
      userId: req.user.id,
      mime: req.file.mimetype,
      fileName: req.file.originalname,
      buffer: req.file.buffer,
    });
    const base = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
    res.status(201).json({ url: `${base.replace(/\/$/, '')}/api/media/${id}` });
  } catch (err) {
    console.error('upload:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// multer errors (e.g. file too large) surface here
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large — max 5 MB' : err.message });
  }
  next(err);
});

module.exports = router;
