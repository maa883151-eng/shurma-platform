const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const { checkContent, getLogs, getRules, createRule, getStats } = require('../controllers/guard.controller');

router.post('/check', auth, checkContent);
router.get('/stats', auth, getStats);
router.get('/logs', auth, adminOnly, getLogs);
router.get('/rules', auth, getRules);
router.post('/rules', auth, adminOnly, createRule);

module.exports = router;
