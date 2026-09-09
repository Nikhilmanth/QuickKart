import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, bad } from '../auth.js';
import { publish, orderRoom } from '../events.js';
import { setOrderStatus } from './orders.js';

const r = Router();

/** All /api/partner routes need PARTNER role except where noted */
function partnerOnly(req, res, next) {
  if (req.user?.role !== 'PARTNER') return res.status(403).json({ error: 'Partner account required' });
  next();
}
const me = (id) => db.prepare('SELECT * FROM partners WHERE id=?').get(id);

r.get('/me', requireAuth, partnerOnly, (req, res) => {
  const p = me(req.user.id);
  if (!p) return bad(res, 'Partner not found', 404);
  res.json({ partner: p });
});

r.post('/status', requireAuth, partnerOnly, (req, res) => {
  const status = req.body?.online ? 'ONLINE' : 'OFFLINE';
  db.prepare('UPDATE partners SET status=? WHERE id=?').run(status, req.user.id);
  res.json({ partner: me(req.user.id) });
});

r.post('/location', requireAuth, partnerOnly, (req, res) => {
  const lat = Number(req.body?.lat), lng = Number(req.body?.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return bad(res, 'lat/lng required');
  const p = me(req.user.id);
  db.prepare('UPDATE partners SET lat=?, lng=? WHERE id=?').run(lat, lng, req.user.id);
  // push to every active assigned order room
  const activeOrders = db.prepare(
    `SELECT id FROM orders WHERE partner_id=? AND status IN ('PICKING','OUT_FOR_DELIVERY')`
  ).all(req.user.id);
  for (const o of activeOrders) publish(orderRoom(o.id), 'partner:location', { lat, lng });
  res.json({ ok: true });
});

r.get('/orders', requireAuth, partnerOnly, (req, res) => {
  const decorate = (o) => ({ ...o, items: db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id),
                            customer_address: JSON.parse(o.address_json) });
  const available = db.prepare(
    `SELECT * FROM orders WHERE partner_id IS NULL AND status IN ('CONFIRMED') ORDER BY id ASC LIMIT 20`
  ).all().map(decorate);
  const mine = db.prepare(
    `SELECT * FROM orders WHERE partner_id=? AND status NOT IN ('DELIVERED','CANCELLED') ORDER BY id DESC`
  ).all(req.user.id).map(decorate);
  const history = db.prepare(
    `SELECT * FROM orders WHERE partner_id=? AND status IN ('DELIVERED','CANCELLED') ORDER BY id DESC LIMIT 10`
  ).all(req.user.id).map(decorate);
  res.json({ available, mine, history });
});

r.post('/orders/:id/accept', requireAuth, partnerOnly, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o || o.partner_id || o.status !== 'CONFIRMED') return bad(res, 'Order no longer available', 409);
  setOrderStatus(o.id, 'PICKING', { partner_id: req.user.id });
  res.json({ success: true });
});

r.post('/orders/:id/pickup', requireAuth, partnerOnly, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND partner_id=?').get(req.params.id, req.user.id);
  if (!o || !['PICKING'].includes(o.status)) return bad(res, 'Invalid order state', 409);
  setOrderStatus(o.id, 'OUT_FOR_DELIVERY');
  res.json({ success: true });
});

r.post('/orders/:id/deliver', requireAuth, partnerOnly, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND partner_id=?').get(req.params.id, req.user.id);
  if (!o || o.status !== 'OUT_FOR_DELIVERY') return bad(res, 'Invalid order state', 409);
  if (String(req.body?.otp) !== o.delivery_otp) return bad(res, 'Wrong delivery OTP', 401);
  setOrderStatus(o.id, 'DELIVERED');
  db.prepare(`UPDATE orders SET payment_status = CASE WHEN payment_method='COD' THEN 'PAID' ELSE payment_status END WHERE id=?`)
    .run(o.id);
  db.prepare(`UPDATE partners SET status='ONLINE' WHERE id=?`).run(req.user.id);
  res.json({ success: true, message: 'Delivered! 🎉' });
});

export default r;
