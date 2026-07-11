const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getProducts, getProduct, getCategories, becomeVendor, createProduct,
  getCart, addToCart, removeFromCart, checkout, getOrders, stripeWebhook,
  getWishlist, addToWishlist, removeFromWishlist, getFlashDeals, setFlashDeal, addReview,
} = require('../controllers/shop.controller');

// Stripe webhook — raw body, no auth
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

router.get('/categories', getCategories);
router.get('/deals', auth, getFlashDeals);
router.get('/products', auth, getProducts);
router.get('/products/:slug', auth, getProduct);
router.patch('/products/:slug/deal', auth, setFlashDeal);
router.post('/products/:productId/reviews', auth, addReview);
router.post('/vendors', auth, becomeVendor);
router.post('/products', auth, createProduct);
router.get('/cart', auth, getCart);
router.post('/cart', auth, addToCart);
router.delete('/cart/:productId', auth, removeFromCart);
router.post('/checkout', auth, checkout);
router.get('/orders', auth, getOrders);
router.get('/wishlist', auth, getWishlist);
router.post('/wishlist', auth, addToWishlist);
router.delete('/wishlist/:productId', auth, removeFromWishlist);

module.exports = router;
