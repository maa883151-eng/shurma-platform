const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getFeed, getExploreFeed } = require('../controllers/feed.controller');

router.get('/', auth, getFeed);
router.get('/explore', auth, getExploreFeed);

module.exports = router;
