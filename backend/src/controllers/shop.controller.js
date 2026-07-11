const pool = require('../config/db');
const { createShopCheckout } = require('../services/stripe.service');
const { constructWebhookEvent } = require('../services/stripe.service');

const getProducts = async (req, res) => {
  try {
    const { category, q, page = 1 } = req.query;
    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;
    let where = 'WHERE p.is_active=TRUE';
    const params = [];

    if (category) {
      params.push(category);
      where += ` AND sc.slug=$${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }
    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT p.*, sc.name AS category_name, sv.shop_name, sv.slug AS vendor_slug
       FROM shop_products p
       JOIN shop_vendors sv ON sv.id=p.vendor_id
       LEFT JOIN shop_categories sc ON sc.id=p.category_id
       ${where}
       ORDER BY p.total_sales DESC, p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ products: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, sc.name AS category_name, sv.shop_name, sv.slug AS vendor_slug,
              sv.user_id AS vendor_user_id
       FROM shop_products p
       JOIN shop_vendors sv ON sv.id=p.vendor_id
       LEFT JOIN shop_categories sc ON sc.id=p.category_id
       WHERE p.slug=$1`,
      [req.params.slug]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });

    const { rows: reviews } = await pool.query(
      `SELECT sr.*, u.name, u.avatar FROM shop_reviews sr
       JOIN users u ON u.id=sr.user_id WHERE sr.product_id=$1
       ORDER BY sr.created_at DESC LIMIT 10`,
      [rows[0].id]
    );
    res.json({ product: rows[0], reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shop_categories ORDER BY name');
    res.json({ categories: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const becomeVendor = async (req, res) => {
  try {
    const { shop_name, description } = req.body;
    if (!shop_name) return res.status(400).json({ error: 'Shop name required' });

    const slug = shop_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { rows } = await pool.query(
      `INSERT INTO shop_vendors (user_id, shop_name, slug, description)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET shop_name=$2, description=$4
       RETURNING *`,
      [req.user.id, shop_name, slug, description || null]
    );
    res.status(201).json({ vendor: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const { rows: vendor } = await pool.query('SELECT id FROM shop_vendors WHERE user_id=$1', [req.user.id]);
    if (!vendor[0]) return res.status(403).json({ error: 'Must be a vendor first' });

    const { name, description, price, stock, images, category_id, compare_price, tags } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required' });

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const { rows } = await pool.query(
      `INSERT INTO shop_products (vendor_id, category_id, name, slug, description, price, compare_price, stock, images, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [vendor[0].id, category_id || null, name, slug, description || null, price, compare_price || null, stock || 0, images || '{}', tags || '{}']
    );
    res.status(201).json({ product: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCart = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ci.*, p.name, p.price, p.images, p.slug, p.stock, sv.shop_name
       FROM shop_cart_items ci
       JOIN shop_products p ON p.id=ci.product_id
       JOIN shop_vendors sv ON sv.id=p.vendor_id
       WHERE ci.user_id=$1`,
      [req.user.id]
    );
    const total = rows.reduce((sum, item) => sum + item.price * item.quantity, 0);
    res.json({ cart: rows, total: parseFloat(total.toFixed(2)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addToCart = async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    await pool.query(
      `INSERT INTO shop_cart_items (user_id, product_id, quantity)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity=shop_cart_items.quantity+$3`,
      [req.user.id, product_id, quantity]
    );
    res.json({ added: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const removeFromCart = async (req, res) => {
  try {
    await pool.query('DELETE FROM shop_cart_items WHERE user_id=$1 AND product_id=$2', [req.user.id, req.params.productId]);
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const checkout = async (req, res) => {
  try {
    const { rows: cartItems } = await pool.query(
      `SELECT ci.*, p.name, p.price, p.stock, sv.id AS vendor_id FROM shop_cart_items ci
       JOIN shop_products p ON p.id=ci.product_id
       JOIN shop_vendors sv ON sv.id=p.vendor_id
       WHERE ci.user_id=$1`,
      [req.user.id]
    );
    if (!cartItems.length) return res.status(400).json({ error: 'Cart is empty' });

    const subtotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const total = parseFloat(subtotal.toFixed(2));
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    // Create order first
    const { rows: order } = await pool.query(
      `INSERT INTO shop_orders (user_id, subtotal, total, status) VALUES ($1,$2,$3,'pending') RETURNING *`,
      [req.user.id, subtotal, total]
    );
    const orderId = order[0].id;

    for (const item of cartItems) {
      await pool.query(
        `INSERT INTO shop_order_items (order_id, product_id, vendor_id, name, price, quantity)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [orderId, item.product_id, item.vendor_id, item.name, item.price, item.quantity]
      );
    }

    const lineItems = cartItems.map(i => ({
      price_data: {
        currency: 'usd',
        product_data: { name: i.name },
        unit_amount: Math.round(i.price * 100),
      },
      quantity: i.quantity,
    }));

    const session = await createShopCheckout({
      lineItems,
      orderId,
      successUrl: `${clientUrl}/shop/orders?success=1`,
      cancelUrl: `${clientUrl}/shop/cart`,
    });

    if (!session) {
      // Demo mode: mark paid immediately
      await pool.query('UPDATE shop_orders SET status=$1 WHERE id=$2', ['paid', orderId]);
      await pool.query('DELETE FROM shop_cart_items WHERE user_id=$1', [req.user.id]);
      return res.json({ demo: true, orderId });
    }

    await pool.query('UPDATE shop_orders SET stripe_session_id=$1 WHERE id=$2', [session.id, orderId]);
    res.json({ url: session.url, orderId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, json_agg(oi.*) AS items FROM shop_orders o
       LEFT JOIN shop_order_items oi ON oi.order_id=o.id
       WHERE o.user_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json({ orders: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const stripeWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const event = constructWebhookEvent(req.body, sig);
    if (!event) return res.json({ received: true });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.metadata?.type === 'shop') {
        await pool.query(
          'UPDATE shop_orders SET status=$1, stripe_payment_intent=$2 WHERE stripe_session_id=$3',
          ['paid', session.payment_intent, session.id]
        );
        // Clear cart — get user from order
        const { rows } = await pool.query('SELECT user_id FROM shop_orders WHERE stripe_session_id=$1', [session.id]);
        if (rows[0]) await pool.query('DELETE FROM shop_cart_items WHERE user_id=$1', [rows[0].user_id]);
      } else if (session.metadata?.type === 'tip') {
        await pool.query(
          'UPDATE stream_tips SET status=$1 WHERE stripe_session_id=$2',
          ['completed', session.id]
        );
      }
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── Wishlist ──
const getWishlist = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, sc.name AS category_name, sv.shop_name, sv.slug AS vendor_slug,
              wl.created_at AS wishlisted_at
       FROM shop_wishlists wl
       JOIN shop_products p ON p.id=wl.product_id
       JOIN shop_vendors sv ON sv.id=p.vendor_id
       LEFT JOIN shop_categories sc ON sc.id=p.category_id
       WHERE wl.user_id=$1
       ORDER BY wl.created_at DESC`,
      [req.user.id]
    );
    res.json({ wishlist: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addToWishlist = async (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id required' });
    const { rowCount } = await pool.query(
      'INSERT INTO shop_wishlists (user_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, product_id]
    );
    res.json({ added: rowCount > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    await pool.query('DELETE FROM shop_wishlists WHERE user_id=$1 AND product_id=$2', [req.user.id, req.params.productId]);
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Flash Deals ──
const getFlashDeals = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, sc.name AS category_name, sv.shop_name, sv.slug AS vendor_slug
       FROM shop_products p
       JOIN shop_vendors sv ON sv.id=p.vendor_id
       LEFT JOIN shop_categories sc ON sc.id=p.category_id
       WHERE p.is_active=TRUE AND p.deal_price IS NOT NULL AND p.deal_ends_at > NOW()
       ORDER BY p.deal_ends_at ASC
       LIMIT 12`,
      []
    );
    res.json({ deals: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const setFlashDeal = async (req, res) => {
  try {
    const { slug } = req.params;
    const { deal_price, deal_ends_at } = req.body;
    const { rows: vendor } = await pool.query('SELECT id FROM shop_vendors WHERE user_id=$1', [req.user.id]);
    if (!vendor[0]) return res.status(403).json({ error: 'Vendor only' });
    const { rows } = await pool.query(
      `UPDATE shop_products SET deal_price=$1, deal_ends_at=$2
       WHERE slug=$3 AND vendor_id=$4 RETURNING *`,
      [deal_price || null, deal_ends_at || null, slug, vendor[0].id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Product not found or not yours' });
    res.json({ product: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Reviews ──
const addReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1–5 required' });
    const { rows } = await pool.query(
      `INSERT INTO shop_reviews (product_id, user_id, rating, comment) VALUES ($1,$2,$3,$4)
       ON CONFLICT (product_id, user_id) DO UPDATE SET rating=$3, comment=$4 RETURNING *`,
      [productId, req.user.id, rating, comment || null]
    );
    // Update aggregate
    await pool.query(
      `UPDATE shop_products SET rating=(SELECT AVG(rating)::DECIMAL(2,1) FROM shop_reviews WHERE product_id=$1),
       review_count=(SELECT COUNT(*) FROM shop_reviews WHERE product_id=$1) WHERE id=$1`,
      [productId]
    );
    res.status(201).json({ review: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getProducts, getProduct, getCategories, becomeVendor, createProduct,
  getCart, addToCart, removeFromCart, checkout, getOrders, stripeWebhook,
  getWishlist, addToWishlist, removeFromWishlist, getFlashDeals, setFlashDeal, addReview,
};
