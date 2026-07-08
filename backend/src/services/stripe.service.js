const Stripe = require('stripe');

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
}

function requireStripe(res) {
  if (!stripe) {
    res.status(503).json({ error: 'Payments not configured' });
    return false;
  }
  return true;
}

async function createShopCheckout({ lineItems, orderId, successUrl, cancelUrl, metadata = {} }) {
  if (!stripe) return null;
  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { orderId, type: 'shop', ...metadata },
  });
}

async function createTipCheckout({ amount, streamId, toUserId, fromUserId, successUrl, cancelUrl }) {
  if (!stripe) return null;
  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'Stream Tip' },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { type: 'tip', streamId, toUserId, fromUserId },
  });
}

function constructWebhookEvent(payload, signature) {
  if (!stripe) return null;
  return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { stripe, requireStripe, createShopCheckout, createTipCheckout, constructWebhookEvent };
