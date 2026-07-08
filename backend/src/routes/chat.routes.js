const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getChats, createChat, getChat } = require('../controllers/chat.controller');

router.get('/', auth, getChats);
router.post('/', auth, createChat);
router.get('/:id', auth, getChat);

module.exports = router;
