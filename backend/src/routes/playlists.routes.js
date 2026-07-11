const router = require('express').Router();
const { auth } = require('../middleware/auth');
const {
  getPlaylists, createPlaylist, getPlaylist, addToPlaylist,
  removeFromPlaylist, deletePlaylist, addWatchLater, removeWatchLater, getWatchLater,
} = require('../controllers/playlists.controller');

router.get('/', auth, getPlaylists);
router.post('/', auth, createPlaylist);
router.get('/watch-later', auth, getWatchLater);
router.post('/watch-later', auth, addWatchLater);
router.delete('/watch-later/:postId', auth, removeWatchLater);
router.get('/:id', auth, getPlaylist);
router.post('/:id/items', auth, addToPlaylist);
router.delete('/:id/items/:postId', auth, removeFromPlaylist);
router.delete('/:id', auth, deletePlaylist);

module.exports = router;
