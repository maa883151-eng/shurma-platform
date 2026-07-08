const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  createPost, getPost, getUserPosts, deletePost,
  likePost, unlikePost, getComments, addComment
} = require('../controllers/post.controller');

router.post('/', auth, createPost);
router.get('/:id', auth, getPost);
router.get('/user/:id', auth, getUserPosts);
router.delete('/:id', auth, deletePost);
router.post('/:id/like', auth, likePost);
router.delete('/:id/like', auth, unlikePost);
router.get('/:id/comments', auth, getComments);
router.post('/:id/comments', auth, addComment);

module.exports = router;
