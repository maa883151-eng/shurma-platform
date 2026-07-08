const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getMessages, sendMessage } = require('../controllers/message.controller');

router.get('/:chatId', auth, getMessages);
router.post('/:chatId', auth, sendMessage);

module.exports = router;
