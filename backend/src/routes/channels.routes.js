const router = require('express').Router();
const { auth } = require('../middleware/auth');
const {
  getChannels, getMyChannels, createChannel, getChannel,
  subscribe, unsubscribe, getChannelPosts, createChannelPost,
  likeChannelPost, unlikeChannelPost, pinChannelPost,
} = require('../controllers/channels.controller');

router.get('/', auth, getChannels);
router.get('/mine', auth, getMyChannels);
router.post('/', auth, createChannel);
router.get('/:id', auth, getChannel);
router.post('/:id/subscribe', auth, subscribe);
router.delete('/:id/subscribe', auth, unsubscribe);
router.get('/:id/posts', auth, getChannelPosts);
router.post('/:id/posts', auth, createChannelPost);
router.post('/:id/posts/:postId/like', auth, likeChannelPost);
router.delete('/:id/posts/:postId/like', auth, unlikeChannelPost);
router.post('/:id/posts/:postId/pin', auth, pinChannelPost);

module.exports = router;
