const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getFeed, getExploreFeed, getTrending, getHashtagFeed } = require('../controllers/feed.controller');

router.get('/', auth, getFeed);
router.get('/explore', auth, getExploreFeed);
router.get('/trending', auth, getTrending);
router.get('/hashtag/:tag', auth, getHashtagFeed);

module.exports = router;
