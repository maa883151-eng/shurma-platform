const express = require('express');
const multer = require('multer');
const router = express.Router();
const { auth } = require('../middleware/auth');
const storage = require('../services/storage.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: storage.MAX_SIZE_BYTES },
});

// POST /api/upload — multipart field "file"; returns { url }
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    if (!storage.isConfigured()) {
      return res.status(503).json({ error: 'Uploads not configured' });
    }
    const invalid = storage.validateImage(req.file);
    if (invalid) return res.status(400).json({ error: invalid });

    const folder = ['avatar', 'post', 'chat', 'product'].includes(req.body.folder)
      ? req.body.folder
      : 'media';
    const path = storage.objectPath(req.user.id, req.file.mimetype, folder);
    const url = await storage.uploadBuffer(req.file.buffer, path, req.file.mimetype);
    res.status(201).json({ url });
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
