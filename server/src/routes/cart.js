import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, bad } from '../auth.js';

const r = Router();
r.use(requireAuth);

function getCart(userId) {
  let cart = db.prepare('SELECT * FROM carts WHERE user_id=?').get(userId);
  if (!cart) {
    const id = db.prepare('INSERT INTO carts (user_id) VALUES (?)').run(userId).lastInsertRowid;
    cart = db.prepare('SELECT * FROM carts WHERE id=?').get(id);
  }
  return cart;
}

function cartPayload(userId) {
  const cart = getCart(userId);
  const items = db.prepare(
    `SELECT ci.product_id, ci.qty, p.name, p.icon, p.image_url, p.unit, p.price, p.mrp, p.stock
     FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.cart_id=?`
  ).all(cart.id);
  const items_total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const mrp_total = items.reduce((s, i) => s + i.mrp * i.qty, 0);
  return {
    items,
    count: items.reduce((s, i) => s + i.qty, 0),
    items_total: Math.round(items_total * 100) / 100,
    mrp_total,
    savings: Math.round((mrp_total - items_total) * 100) / 100,
    delivery_fee: items_total >= 199 ? 0 : 25,
    total: Math.round((items_total + (items_total >= 199 ? 0 : 25)) * 100) / 100,
  };
}

r.get('/', (req, res) => res.json(cartPayload(req.user.id)));

r.post('/items', (req, res) => {
  const productId = Number(req.body?.productId);
  const qty = Math.max(1, Number(req.body?.qty) || 1);
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(productId);
  if (!product) return bad(res, 'Product not found', 404);
  if (product.stock < qty) return bad(res, 'Out of stock', 409);

  const cart = getCart(req.user.id);
  const existing = db.prepare('SELECT * FROM cart_items WHERE cart_id=? AND product_id=?').get(cart.id, productId);
  const newQty = existing ? existing.qty + qty : qty;
  if (product.stock < newQty) return bad(res, `Only ${product.stock} left in stock`, 409);
  if (existing) db.prepare('UPDATE cart_items SET qty=? WHERE id=?').run(newQty, existing.id);
  else db.prepare('INSERT INTO cart_items (cart_id, product_id, qty) VALUES (?,?,?)').run(cart.id, productId, qty);
  res.json(cartPayload(req.user.id));
});

r.patch('/items/:productId', (req, res) => {
  const cart = getCart(req.user.id);
  const item = db.prepare('SELECT * FROM cart_items WHERE cart_id=? AND product_id=?').get(cart.id, req.params.productId);
  if (!item) return bad(res, 'Item not in cart', 404);
  const qty = Number(req.body?.qty);
  if (qty <= 0) db.prepare('DELETE FROM cart_items WHERE id=?').run(item.id);
  else {
    const product = db.prepare('SELECT stock FROM products WHERE id=?').get(item.product_id);
    if (qty > product.stock) return bad(res, `Only ${product.stock} left in stock`, 409);
    db.prepare('UPDATE cart_items SET qty=? WHERE id=?').run(qty, item.id);
  }
  res.json(cartPayload(req.user.id));
});

r.delete('/items/:productId', (req, res) => {
  const cart = getCart(req.user.id);
  db.prepare('DELETE FROM cart_items WHERE cart_id=? AND product_id=?').run(cart.id, req.params.productId);
  res.json(cartPayload(req.user.id));
});

export default r;
