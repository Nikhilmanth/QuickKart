import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole, bad } from '../auth.js';

const r = Router();
r.use(requireAuth, requireRole('ADMIN'));

r.get('/stats', (_req, res) => {
  const q = (sql) => db.prepare(sql).get().c;
  res.json({
    totalOrders: q('SELECT COUNT(*) c FROM orders'),
    activeOrders: q(`SELECT COUNT(*) c FROM orders WHERE status NOT IN ('DELIVERED','CANCELLED')`),
    revenue: db.prepare(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE payment_status='PAID'`).get().s,
    customers: q('SELECT COUNT(*) c FROM users'),
    products: q('SELECT COUNT(*) c FROM products'),
    partners: q('SELECT COUNT(*) c FROM partners'),
    lowStock: q('SELECT COUNT(*) c FROM products WHERE stock < 20'),
  });
});

r.get('/orders', (_req, res) => {
  const orders = db.prepare(
    `SELECT o.*, u.phone AS customer_phone, u.name AS customer_name, p.name AS partner_name
     FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN partners p ON p.id=o.partner_id
     ORDER BY o.id DESC LIMIT 100`
  ).all();
  const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id=?');
  res.json({ orders: orders.map(o => ({ ...o, items: itemsStmt.all(o.id), address: JSON.parse(o.address_json) })) });
});

r.patch('/orders/:id/status', (req, res) => {
  const allowed = ['PLACED', 'CONFIRMED', 'PICKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  const status = String(req.body?.status || '').toUpperCase();
  if (!allowed.includes(status)) return bad(res, 'Invalid status');
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ success: true });
});

r.get('/categories', (_req, res) => {
  res.json({ categories: db.prepare('SELECT * FROM categories ORDER BY id').all() });
});

r.get('/products', (_req, res) => {
  res.json({ products: db.prepare(
    `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.id DESC`
  ).all() });
});

r.post('/products', (req, res) => {
  try {
    let {
      name,
      brand = '',
      category_id,
      unit = 'Standard',
      icon = '📦',
      image_url = '',
      rating = 4.8,
      reviews_count = 120,
      mrp,
      price,
      stock = 50,
      description = '',
    } = req.body || {};

    if (!name || !String(name).trim()) return bad(res, 'Product name is required');
    if (price == null || isNaN(Number(price))) return bad(res, 'Valid price is required');
    price = Math.max(0, Number(price));

    // If mrp is missing or lower than price, set reasonable mrp
    if (mrp == null || isNaN(Number(mrp)) || Number(mrp) <= 0) {
      mrp = Math.round(price * 1.15) || price;
    } else {
      mrp = Number(mrp);
    }

    // Resolve valid category
    let catId = Number(category_id);
    let catExists = catId ? db.prepare('SELECT id FROM categories WHERE id=?').get(catId) : null;
    if (!catExists) {
      const firstCat = db.prepare('SELECT id FROM categories LIMIT 1').get();
      if (!firstCat) return bad(res, 'No category exists in system');
      catId = firstCat.id;
    }

    const id = db.prepare(
      `INSERT INTO products (name,brand,category_id,unit,icon,image_url,rating,reviews_count,mrp,price,stock,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      String(name).trim(),
      String(brand).trim(),
      catId,
      String(unit).trim() || 'Standard',
      String(icon).trim() || '📦',
      String(image_url).trim(),
      Number(rating) || 4.8,
      Number(reviews_count) || 120,
      mrp,
      price,
      Math.max(0, Number(stock) || 0),
      String(description).trim()
    ).lastInsertRowid;

    res.json({
      success: true,
      product: db.prepare('SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=?').get(id),
    });
  } catch (err) {
    console.error('[admin] Error inserting product:', err);
    bad(res, `Failed to add product: ${err.message}`, 500);
  }
});

r.patch('/products/:id', (req, res) => {
  try {
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
    if (!p) return bad(res, 'Product not found', 404);
    const next = { ...p, ...['name', 'brand', 'unit', 'icon', 'image_url', 'rating', 'reviews_count', 'mrp', 'price', 'stock', 'category_id']
      .filter(k => req.body?.[k] != null)
      .reduce((o, k) => ({ ...o, [k]: k === 'stock' || k === 'reviews_count' || k === 'price' || k === 'mrp' || k === 'category_id' ? Number(req.body[k]) : req.body[k] }), {}) };

    // Validate category if changed
    if (next.category_id) {
      const catOk = db.prepare('SELECT id FROM categories WHERE id=?').get(next.category_id);
      if (!catOk) next.category_id = p.category_id;
    }

    db.prepare('UPDATE products SET name=?, brand=?, unit=?, icon=?, image_url=?, rating=?, reviews_count=?, mrp=?, price=?, stock=?, category_id=? WHERE id=?')
      .run(next.name, next.brand, next.unit, next.icon, next.image_url, next.rating, next.reviews_count, next.mrp, next.price, next.stock, next.category_id, req.params.id);
    res.json({ product: db.prepare('SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=?').get(req.params.id) });
  } catch (err) {
    console.error('[admin] Error updating product:', err);
    bad(res, `Failed to update product: ${err.message}`, 500);
  }
});

r.delete('/products/:id', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE product_id=?').run(req.params.id);
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

export default r;
