const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getStreams, createStream, getStream, startStream, endStream,
  addStreamComment, tipStreamer, getStreamProducts
} = require('../controllers/stream.controller');

router.get('/', auth, getStreams);
router.post('/', auth, createStream);
router.get('/:id', auth, getStream);
router.post('/:id/start', auth, startStream);
router.post('/:id/end', auth, endStream);
router.post('/:id/comments', auth, addStreamComment);
router.post('/:id/tip', auth, tipStreamer);
router.get('/:id/products', auth, getStreamProducts);

module.exports = router;
