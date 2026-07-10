const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { createStory, getStories, viewStory, getStoryViews, deleteStory } = require('../controllers/story.controller');

router.get('/', auth, getStories);
router.post('/', auth, createStory);
router.post('/:id/view', auth, viewStory);
router.get('/:id/views', auth, getStoryViews);
router.delete('/:id', auth, deleteStory);

module.exports = router;
