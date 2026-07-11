const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { getPoll, votePoll } = require('../controllers/polls.controller');

router.get('/:id', auth, getPoll);
router.post('/:id/vote', auth, votePoll);

module.exports = router;
