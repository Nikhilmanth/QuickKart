import { Router } from 'express';
import { db } from '../db.js';

const r = Router();

r.get('/categories', (_req, res) => {
  res.json({ categories: db.prepare('SELECT * FROM categories ORDER BY id').all() });
});

/** /api/catalog/products?q=milk&category=3&sort=price */
r.get('/products', (req, res) => {
  const { q, category, sort } = req.query;
  let sql = `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE 1=1`;
  const args = [];
  if (q) { sql += ` AND (p.name LIKE ? OR p.brand LIKE ? OR c.name LIKE ?)`; args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (category) { sql += ` AND p.category_id = ?`; args.push(category); }
  if (sort === 'price') sql += ` ORDER BY p.price ASC`;
  else if (sort === '-price') sql += ` ORDER BY p.price DESC`;
  else sql += ` ORDER BY p.id ASC`;
  res.json({ products: db.prepare(sql).all(...args) });
});

r.get('/products/:id', (req, res) => {
  const product = db.prepare(
    `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=?`
  ).get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

export default r;
