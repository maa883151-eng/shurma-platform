const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getNotifications, getUnreadCount, markAllRead } = require('../controllers/notification.controller');

router.get('/', auth, getNotifications);
router.get('/unread-count', auth, getUnreadCount);
router.post('/read', auth, markAllRead);

module.exports = router;
