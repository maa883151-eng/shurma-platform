const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getChats, createChat, getChat, markChatRead } = require('../controllers/chat.controller');

router.get('/', auth, getChats);
router.post('/', auth, createChat);
router.get('/:id', auth, getChat);
router.post('/:id/read', auth, markChatRead);

module.exports = router;
