import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireAuth, bad } from '../auth.js';
import { publish, orderRoom, adminRoom } from '../events.js';

export const r = Router();

// Razorpay REST client via native fetch (the razorpay npm SDK breaks on Node 25)
const RZP_LIVE = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const RZP_AUTH = () => 'Basic ' + Buffer
  .from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`)
  .toString('base64');

if (RZP_LIVE) console.log('[payments] Razorpay LIVE mode');
else console.log('[payments] No Razorpay keys found -> MOCK mode (orders auto-confirm)');

export const razorpayMode = () => (RZP_LIVE ? 'LIVE' : 'MOCK');

async function rzpCreateOrder(amountPaise, receipt) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: RZP_AUTH(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay error ${res.status}`);
  return data;
}

/** Create a payment for an order. POST /api/payments/create { orderId } */
r.post('/create', requireAuth, async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.body?.orderId, req.user.id);
  if (!order) return bad(res, 'Order not found', 404);
  if (order.payment_status === 'PAID') return bad(res, 'Order already paid');
  const amountPaise = Math.round(order.total * 100);

  if (!RZP_LIVE) {
    // MOCK: pending payment; /verify confirms it instantly
    db.prepare('INSERT INTO payments (order_id, amount, status, provider) VALUES (?,?,?,?)')
      .run(order.id, order.total, 'CREATED', 'mock');
    return res.json({ mode: 'MOCK', orderId: order.id });
  }

  try {
    const rp = await rzpCreateOrder(amountPaise, `ord_${order.id}`);
    db.prepare(`INSERT INTO payments (order_id, amount, status, provider, rp_order_id)
                VALUES (?,?,?,?,?)`).run(order.id, order.total, 'CREATED', 'razorpay', rp.id);
    res.json({
      mode: 'LIVE',
      keyId: process.env.RAZORPAY_KEY_ID,
      rpOrderId: rp.id,
      amount: amountPaise,
      currency: 'INR',
    });
  } catch (e) {
    bad(res, e.message, 502);
  }
});

/** Verify payment. POST /api/payments/verify */
r.post('/verify', requireAuth, (req, res) => {
  const { orderId, rpOrderId, rpPaymentId, rpSignature } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(orderId, req.user.id);
  if (!order) return bad(res, 'Order not found', 404);

  let ok = true;
  if (rzp && rpOrderId) {
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${rpOrderId}|${rpPaymentId}`).digest('hex');
    ok = expected === rpSignature;
  }
  if (!ok) {
    db.prepare(`UPDATE payments SET status='FAILED' WHERE order_id=?`).run(order.id);
    return bad(res, 'Payment verification failed', 400);
  }

  const pay = db.prepare('SELECT * FROM payments WHERE order_id=? ORDER BY id DESC LIMIT 1').get(order.id);
  if (pay) db.prepare(`UPDATE payments SET status='PAID', rp_order_id=?, rp_payment_id=?, rp_signature=? WHERE id=?`)
    .run(rpOrderId || null, rpPaymentId || null, rpSignature || null, pay.id);

  db.prepare(`UPDATE orders SET payment_status='PAID', status=CASE WHEN status='PLACED' THEN 'CONFIRMED' ELSE status END WHERE id=?`)
    .run(order.id);

  publish(orderRoom(order.id), 'order:update', { orderId: order.id, status: db.prepare('SELECT status FROM orders WHERE id=?').get(order.id).status, paymentStatus: 'PAID' });
  publish(adminRoom, 'refresh', {});
  res.json({ success: true, message: 'Payment confirmed' });
});

/** Razorpay server-webhook (configure in dashboard later). POST /api/payments/webhook */
r.post('/webhook', (req, res) => {
  console.log('[razorpay webhook]', req.body?.event, req.body?.payload?.payment?.entity?.id);
  res.json({ ok: true });
});

export default r;

