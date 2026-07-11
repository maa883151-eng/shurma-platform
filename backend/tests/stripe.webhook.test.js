// Webhook tests run against Stripe's REAL signature verification:
// payloads are signed with stripe's generateTestHeaderString and the
// webhook secret from tests/setup.js, so a tampered or unsigned payload
// must be rejected exactly as it would be in production.
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_key_for_signature_tests';

const request = require('supertest');
const express = require('express');
const Stripe = require('stripe');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
const pool = require('../src/config/db');

const shopRoutes = require('../src/routes/shop.routes');

const app = express();
app.use('/api/shop', shopRoutes); // webhook route applies its own raw-body parser

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

function signedHeader(payload) {
  return stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
}

function checkoutCompletedEvent(metadata, session = {}) {
  return JSON.stringify({
    id: 'evt_test_1',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        object: 'checkout.session',
        payment_intent: 'pi_test_456',
        metadata,
        ...session,
      },
    },
  });
}

function postWebhook(payload, header) {
  return request(app)
    .post('/api/shop/webhook')
    .set('stripe-signature', header)
    .set('Content-Type', 'application/json')
    .send(payload);
}

describe('POST /api/shop/webhook', () => {
  it('rejects a payload with an invalid signature', async () => {
    const payload = checkoutCompletedEvent({ type: 'shop' });
    const res = await postWebhook(payload, 't=123,v1=forged_signature');
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects a payload that was tampered with after signing', async () => {
    const payload = checkoutCompletedEvent({ type: 'shop' });
    const header = signedHeader(payload);
    const tampered = payload.replace('pi_test_456', 'pi_attacker');
    const res = await postWebhook(tampered, header);
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('marks the order paid and clears the buyer cart on a completed shop checkout', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // UPDATE shop_orders
      .mockResolvedValueOnce({ rows: [{ user_id: 'buyer-1' }] }) // look up buyer
      .mockResolvedValueOnce({ rows: [] }); // DELETE cart items

    const payload = checkoutCompletedEvent({ type: 'shop', orderId: 'order-1' });
    const res = await postWebhook(payload, signedHeader(payload));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    const [updateSql, updateParams] = pool.query.mock.calls[0];
    expect(updateSql).toMatch(/UPDATE shop_orders SET status/);
    expect(updateParams).toEqual(['paid', 'pi_test_456', 'cs_test_123']);

    const [deleteSql, deleteParams] = pool.query.mock.calls[2];
    expect(deleteSql).toMatch(/DELETE FROM shop_cart_items/);
    expect(deleteParams).toEqual(['buyer-1']);
  });

  it('completes the tip on a completed tip checkout', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const payload = checkoutCompletedEvent({
      type: 'tip',
      streamId: 'stream-1',
      toUserId: 'streamer-1',
      fromUserId: 'fan-1',
    });
    const res = await postWebhook(payload, signedHeader(payload));

    expect(res.status).toBe(200);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE stream_tips SET status/);
    expect(params).toEqual(['completed', 'cs_test_123']);
  });

  it('acknowledges unrelated event types without touching the database', async () => {
    const payload = JSON.stringify({
      id: 'evt_test_2',
      object: 'event',
      type: 'payment_intent.created',
      data: { object: { id: 'pi_test_789' } },
    });
    const res = await postWebhook(payload, signedHeader(payload));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(pool.query).not.toHaveBeenCalled();
  });
});
