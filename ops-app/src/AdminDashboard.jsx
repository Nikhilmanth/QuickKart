import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import QuickKartLogo from './QuickKartLogo.jsx';

export default function AdminDashboard({ session, onLogout }) {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState('orders');
  const [newP, setNewP] = useState(null); // add-product form state
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const loadAll = () => {
    api.get('/admin/stats').then(setStats).catch(() => {});
    api.get('/admin/orders').then((d) => setOrders(d.orders || [])).catch(() => {});
    api.get('/catalog/categories').then((d) => setCategories(d.categories || [])).catch(() => {});
    if (tab === 'products') {
      api.get('/admin/products').then((d) => setProducts(d.products || [])).catch(() => {});
    }
  };

  useEffect(loadAll, [tab]);

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/admin/orders/${id}/status`, { status });
      loadAll();
    } catch (e) {
      alert(e.message);
    }
  };

  const saveStock = async (p, patch) => {
    try {
      await api.patch(`/admin/products/${p.id}`, patch);
      loadAll();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleCreateProduct = async () => {
    if (!newP.name.trim()) {
      setFormErr('Please enter product name');
      return;
    }
    if (!newP.price || isNaN(Number(newP.price))) {
      setFormErr('Please enter a valid price');
      return;
    }

    setSaving(true);
    setFormErr('');

    try {
      const payload = {
        name: newP.name.trim(),
        brand: newP.brand.trim(),
        category_id: Number(newP.category_id) || (categories[0]?.id ?? 1),
        unit: newP.unit.trim() || 'Standard',
        icon: newP.icon.trim() || '📦',
        image_url: newP.image_url.trim(),
        mrp: newP.mrp ? Number(newP.mrp) : Math.round(Number(newP.price) * 1.15),
        price: Number(newP.price),
        stock: Number(newP.stock) || 0,
      };

      await api.post('/admin/products', payload);
      setNewP(null);
      loadAll();
    } catch (e) {
      setFormErr(e.message || 'Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <QuickKartLogo size="sm" subtitle="Admin" />
        <div className="spacer" />
        <button className={`tab ${tab === 'orders' ? 'on' : ''}`} style={{ marginRight: 6 }} onClick={() => setTab('orders')}>Orders</button>
        <button className={`tab ${tab === 'products' ? 'on' : ''}`} onClick={() => setTab('products')}>Products</button>
        <span className="who">{session.user.name || session.user.phone || session.user.email}</span>
        <button className="out" onClick={onLogout}>Logout</button>
      </header>

      {stats && (
        <div className="stats">
          <div className="stat"><b>₹{stats.revenue}</b><span>Revenue (paid)</span></div>
          <div className="stat"><b>{stats.totalOrders}</b><span>Total orders</span></div>
          <div className="stat"><b>{stats.activeOrders}</b><span>Active orders</span></div>
          <div className="stat"><b>{stats.customers}</b><span>Customers</span></div>
          <div className="stat"><b>{stats.products}</b><span>Products</span></div>
          <div className="stat warn"><b>{stats.lowStock}</b><span>Low stock (&lt;20)</span></div>
        </div>
      )}

      {tab === 'orders' && (
        <main className="list">
          {orders.map((o) => (
            <div className="rowcard" key={o.id}>
              <div>
                <b>#{o.id}</b> · {o.customer_name || 'Customer'} ({o.customer_phone})
                <div className="dim">{o.items.map((i) => `${i.icon || '📦'} ${i.name} × ${i.qty}`).join(', ')}</div>
                <div className="dim">📍 {o.address?.line1 || ''}, {o.address?.city || ''} · {o.partner_name ? `🛵 ${o.partner_name}` : 'No rider assigned'}</div>
              </div>
              <div className="right">
                <b>₹{o.total}</b>
                <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)}>
                  {['PLACED','CONFIRMED','PICKING','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].map((s) => <option key={s}>{s}</option>)}
                </select>
                <span className={`badge ${o.payment_status === 'PAID' ? 'ok' : ''}`}>{o.payment_method} · {o.payment_status}</span>
              </div>
            </div>
          ))}
          {!orders.length && <div className="dim" style={{ textAlign: 'center', padding: '30px' }}>No orders placed yet.</div>}
        </main>
      )}

      {tab === 'products' && (
        <main className="list">
          {!newP && (
            <button
              className="btn"
              onClick={() => {
                setFormErr('');
                setNewP({
                  name: '',
                  brand: '',
                  category_id: categories[0]?.id || 1,
                  unit: '',
                  icon: '📦',
                  image_url: '',
                  mrp: '',
                  price: '',
                  stock: 50,
                });
              }}
            >
              + Add product
            </button>
          )}

          {newP && (
            <div className="rowcard form" style={{ flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: '15px' }}>✨ Add New Product to QuickKart Catalog</b>
                <button className="out" onClick={() => setNewP(null)} style={{ padding: '2px 8px' }}>✕</button>
              </div>

              {formErr && (
                <div style={{ color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
                  ⚠️ {formErr}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>PRODUCT NAME *</label>
                  <input placeholder="e.g. Amul Salted Butter" value={newP.name} onChange={(e) => setNewP({ ...newP, name: e.target.value })} style={{ width: '100%', marginTop: 3 }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>BRAND</label>
                  <input placeholder="e.g. Amul, Lay's, Maggi" value={newP.brand} onChange={(e) => setNewP({ ...newP, brand: e.target.value })} style={{ width: '100%', marginTop: 3 }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>CATEGORY *</label>
                  <select
                    value={newP.category_id}
                    onChange={(e) => setNewP({ ...newP, category_id: Number(e.target.value) })}
                    style={{ width: '100%', marginTop: 3, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon || '📦'} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>UNIT / PACK SIZE</label>
                  <input placeholder="e.g. 500 ml, 1 kg, 4 pcs" value={newP.unit} onChange={(e) => setNewP({ ...newP, unit: e.target.value })} style={{ width: '100%', marginTop: 3 }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>MRP (₹)</label>
                  <input type="number" placeholder="e.g. 60" value={newP.mrp} onChange={(e) => setNewP({ ...newP, mrp: e.target.value })} style={{ width: '100%', marginTop: 3 }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>SELLING PRICE (₹) *</label>
                  <input type="number" placeholder="e.g. 52" value={newP.price} onChange={(e) => setNewP({ ...newP, price: e.target.value })} style={{ width: '100%', marginTop: 3 }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>INITIAL STOCK</label>
                  <input type="number" placeholder="e.g. 100" value={newP.stock} onChange={(e) => setNewP({ ...newP, stock: e.target.value })} style={{ width: '100%', marginTop: 3 }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>IMAGE URL (HTTPS)</label>
                  <input placeholder="https://images.unsplash.com/..." value={newP.image_url} onChange={(e) => setNewP({ ...newP, image_url: e.target.value })} style={{ width: '100%', marginTop: 3 }} />
                </div>
              </div>

              {newP.image_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: '#f8fafc', borderRadius: 8 }}>
                  <img
                    src={newP.image_url}
                    alt="preview"
                    style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Image preview active</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 8 }}>
                <button className="out" onClick={() => setNewP(null)}>Cancel</button>
                <button className="btn" disabled={saving || !newP.name || !newP.price} onClick={handleCreateProduct}>
                  {saving ? 'Saving…' : 'Save Product'}
                </button>
              </div>
            </div>
          )}

          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>Name &amp; Brand</th>
                <th>Category</th>
                <th>Price / MRP</th>
                <th>Stock</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={p.stock < 20 ? 'low' : ''}>
                  <td className="icn" style={{ width: '56px' }}>
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'inline';
                        }}
                      />
                    ) : null}
                    <span style={{ display: p.image_url ? 'none' : 'inline', fontSize: '20px' }}>{p.icon || '📦'}</span>
                  </td>
                  <td>
                    <b>{p.name}</b>
                    <div className="dim">{p.brand ? `${p.brand} · ` : ''}{p.unit || 'Standard'}</div>
                  </td>
                  <td className="dim">{p.category_name}</td>
                  <td>
                    <b>₹{p.price}</b>
                    {p.mrp > p.price && <div className="dim" style={{ textDecoration: 'line-through', fontSize: '11px' }}>₹{p.mrp}</div>}
                  </td>
                  <td>
                    <input
                      className="stockin"
                      type="number"
                      defaultValue={p.stock}
                      onBlur={(e) => +e.target.value !== p.stock && saveStock(p, { stock: +e.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      className="out"
                      title="Delete product"
                      onClick={() => {
                        if (confirm(`Delete ${p.name}?`)) {
                          api.del(`/admin/products/${p.id}`).then(loadAll).catch((e) => alert(e.message));
                        }
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      )}
    </div>
  );
}
