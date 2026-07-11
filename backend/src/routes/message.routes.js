const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { getMessages, sendMessage, reactToMessage, removeReaction, deleteMessage } = require('../controllers/message.controller');

router.get('/:chatId', auth, getMessages);
router.post('/:chatId', auth, sendMessage);
router.post('/:chatId/:messageId/react', auth, reactToMessage);
router.delete('/:chatId/:messageId/react', auth, removeReaction);
router.delete('/:chatId/:messageId', auth, deleteMessage);

module.exports = router;
