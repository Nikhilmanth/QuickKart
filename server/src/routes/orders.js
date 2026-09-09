import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireAuth, bad } from '../auth.js';
import { publish, orderRoom, adminRoom } from '../events.js';

const r = Router();
r.use(requireAuth);

export function setOrderStatus(orderId, status, extra = {}) {
  const sets = ['status=?'];
  const args = [status];
  if (status === 'DELIVERED') { sets.push(`delivered_at=datetime('now')`); }
  Object.entries(extra).forEach(([k, v]) => { sets.push(`${k}=?`); args.push(v); });
  args.push(orderId);
  db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id=?`).run(...args);
  publish(orderRoom(orderId), 'order:update', { orderId, status });
  publish(adminRoom, 'refresh', {});
}

/** POST /api/orders { address: {...}, paymentMethod: 'COD'|'ONLINE' } */
r.post('/', (req, res) => {
  const cart = db.prepare('SELECT * FROM carts WHERE user_id=?').get(req.user.id);
  if (!cart) return bad(res, 'Your cart is empty');
  const items = db.prepare(
    `SELECT ci.product_id, ci.qty, p.name, p.icon, p.image_url, p.unit, p.price, p.stock
     FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.cart_id=?`
  ).all(cart.id);
  if (!items.length) return bad(res, 'Your cart is empty');

  // Validate stock before placing
  for (const i of items) if (i.qty > i.stock) return bad(res, `${i.name} has only ${i.stock} left`, 409);

  const a = req.body?.address || {};
  if (!a.line1) return bad(res, 'Delivery address required');
  const paymentMethod = req.body?.paymentMethod === 'ONLINE' ? 'ONLINE' : 'COD';

  const items_total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const delivery_fee = items_total >= 199 ? 0 : 25;
  const total = Math.round((items_total + delivery_fee) * 100) / 100;
  const delivery_otp = String(crypto.randomInt(1000, 9999));

  db.exec('BEGIN');
  let orderId;
  try {
    orderId = db.prepare(
      `INSERT INTO orders (user_id, status, items_total, delivery_fee, total, payment_method, address_json, delivery_otp)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(req.user.id, paymentMethod === 'COD' ? 'CONFIRMED' : 'PLACED',
      Math.round(items_total * 100) / 100, delivery_fee, total,
      paymentMethod === 'COD' ? 'COD' : 'ONLINE', JSON.stringify(a), delivery_otp).lastInsertRowid;
    const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, icon, image_url, unit, price, qty) VALUES (?,?,?,?,?,?,?,?)');
    for (const i of items) {
      insItem.run(orderId, i.product_id, i.name, i.icon, i.image_url || '', i.unit, i.price, i.qty);
      db.prepare('UPDATE products SET stock = stock - ? WHERE id=?').run(i.qty, i.product_id);
    }
    db.prepare('DELETE FROM cart_items WHERE cart_id=?').run(cart.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  res.json({ order, delivery_otp }); // OTP shown to customer; partner must collect it on delivery
});

r.get('/', (req, res) => {
  const orders = db.prepare(
    `SELECT o.*, p.name AS partner_name, p.phone AS partner_phone, p.vehicle
     FROM orders o LEFT JOIN partners p ON p.id=o.partner_id
     WHERE o.user_id=? ORDER BY o.id DESC`
  ).all(req.user.id);
  const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id=?');
  res.json({ orders: orders.map(o => ({ ...o, items: itemsStmt.all(o.id), address: JSON.parse(o.address_json) })) });
});

r.get('/:id', (req, res) => {
  const o = db.prepare(
    `SELECT o.*, p.name AS partner_name, p.phone AS partner_phone, p.vehicle, p.lat AS partner_lat, p.lng AS partner_lng
     FROM orders o LEFT JOIN partners p ON p.id=o.partner_id WHERE o.id=? AND o.user_id=?`
  ).get(req.params.id, req.user.id);
  if (!o) return bad(res, 'Order not found', 404);
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id);
  o.address = JSON.parse(o.address_json);
  res.json({ order: o });
});

r.post('/:id/cancel', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!o) return bad(res, 'Order not found', 404);
  if (!['PLACED', 'CONFIRMED'].includes(o.status)) return bad(res, `Cannot cancel once order is ${o.status.toLowerCase()}`);
  setOrderStatus(o.id, 'CANCELLED');
  // restock
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id);
  for (const i of items) db.prepare('UPDATE products SET stock = stock + ? WHERE id=?').run(i.qty, i.product_id);
  res.json({ success: true });
});

// Admin helper re-exported for partner flow use
export default r;
