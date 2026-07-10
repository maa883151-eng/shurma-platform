const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  createPost, getPost, getUserPosts, deletePost,
  likePost, unlikePost, reactToPost, removeReaction,
  repostPost, bookmarkPost, unbookmarkPost, getBookmarks,
  getComments, addComment
} = require('../controllers/post.controller');

router.post('/', auth, createPost);
router.get('/bookmarks/me', auth, getBookmarks);
router.get('/:id', auth, getPost);
router.get('/user/:id', auth, getUserPosts);
router.delete('/:id', auth, deletePost);
router.post('/:id/like', auth, likePost);
router.delete('/:id/like', auth, unlikePost);
router.post('/:id/react', auth, reactToPost);
router.delete('/:id/react', auth, removeReaction);
router.post('/:id/repost', auth, repostPost);
router.post('/:id/bookmark', auth, bookmarkPost);
router.delete('/:id/bookmark', auth, unbookmarkPost);
router.get('/:id/comments', auth, getComments);
router.post('/:id/comments', auth, addComment);

module.exports = router;
