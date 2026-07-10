const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getProfile, getProfileByUsername, updateProfile,
  follow, unfollow, getFollowers, getFollowing, searchUsers, getSuggestions
} = require('../controllers/user.controller');

router.get('/search', auth, searchUsers);
router.get('/suggestions', auth, getSuggestions);
router.get('/:id', auth, getProfile);
router.get('/u/:username', auth, getProfileByUsername);
router.put('/profile', auth, updateProfile);
router.post('/:id/follow', auth, follow);
router.delete('/:id/follow', auth, unfollow);
router.get('/:id/followers', auth, getFollowers);
router.get('/:id/following', auth, getFollowing);

module.exports = router;
