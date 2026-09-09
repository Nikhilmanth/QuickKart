import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import QuickKartLogo from '../components/QuickKartLogo.jsx';

export default function Checkout() {
  const nav = useNavigate();
  const { cart, user, showToast, location } = useApp();
  const [addresses, setAddresses] = useState([]);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ label: 'Home', line1: '', city: '', lat: null, lng: null });
  const [method, setMethod] = useState('ONLINE');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return nav('/login');
    api.get('/auth/addresses').then((d) => setAddresses(d.addresses));
    if (!cart.items.length) nav('/');
  }, []);

  const saveAddress = async () => {
    try {
      const d = await api.post('/auth/addresses', form);
      setAddresses((a) => [...a, d.address]);
      setSel(d.address.id);
      setForm({ label: 'Home', line1: '', city: '', lat: null, lng: null });
    } catch (e) { showToast(e.message); }
  };

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const placeOrder = async () => {
    if (!sel && !form.line1) return setErr('Add or select a delivery address');
    setBusy(true); setErr('');
    try {
      const address = sel ? addresses.find((a) => a.id === sel) : { ...form };
      const { order, delivery_otp } = await api.post('/orders', { address, paymentMethod: method });

      if (method === 'ONLINE') {
        const pay = await api.post('/payments/create', { orderId: order.id });
        if (pay.mode === 'MOCK') {
          await api.post('/payments/verify', { orderId: order.id });
          showToast('Mock payment successful ✅');
          nav(`/track/${order.id}`);
          return;
        }
        const ok = await loadRazorpay();
        if (!ok) throw new Error('Could not load Razorpay checkout');
        window.Razorpay.open({
          key: pay.keyId, amount: pay.amount, currency: pay.currency,
          name: 'QuickKart', description: `Order #${order.id} - Groceries. Delivered Quickly.`, order_id: pay.rpOrderId,
          prefill: { name: user?.name || '', contact: user?.phone || '' },
          theme: { color: '#059669' },
          handler: async (resp) => {
            try {
              await api.post('/payments/verify', {
                orderId: order.id,
                rpOrderId: resp.razorpay_order_id,
                rpPaymentId: resp.razorpay_payment_id,
                rpSignature: resp.razorpay_signature,
              });
              showToast('Payment successful ✅');
              nav(`/track/${order.id}`);
            } catch (e) { setErr(e.message); setBusy(false); }
          },
        });
        setBusy(false);
        return;
      }
      showToast(`Order placed! Delivery OTP: ${delivery_otp}`);
      nav(`/track/${order.id}`);
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand" onClick={() => nav('/')} title="QuickKart">
          <QuickKartLogo size="md" />
        </div>
        <h3>Checkout</h3>
        <button className="btn green" onClick={placeOrder} disabled={busy}>{busy ? 'Placing…' : `Pay ₹${cart.total}`}</button>
      </header>

      <main className="checkout">
        <section className="panel">
          <h3>📍 Delivery address</h3>
          {addresses.map((a) => (
            <label key={a.id} className={`addr ${sel === a.id ? 'sel' : ''}`}>
              <input type="radio" checked={sel === a.id} onChange={() => setSel(a.id)} />
              <div><b>{a.label}</b><div className="muted">{a.line1}, {a.city}</div></div>
            </label>
          ))}
          <details open={!addresses.length}>
            <summary>{addresses.length ? '+ Add new address' : 'Enter your address'}</summary>
            <div className="addr-form">
              <select value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}>
                <option>Home</option><option>Work</option><option>Other</option>
              </select>
              <input placeholder="House no, street, area..." value={form.line1}
                     onChange={(e) => setForm({ ...form, line1: e.target.value })} />
              <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              {location?.address && (
                <button type="button" className="btn ghost loc-use"
                  onClick={() => {
                    const parts = location.address.split(',').map((s) => s.trim());
                    setForm({
                      ...form,
                      line1: location.address,
                      city: parts.length >= 3 ? parts[parts.length - 3] || '' : '',
                      lat: location.lat ?? null,
                      lng: location.lng ?? null,
                    });
                  }}>
                  📍 Use my saved location: {(location.address || '').slice(0, 44)}{(location.address || '').length > 44 ? '…' : ''}
                </button>
              )}
              <button className="btn green" onClick={saveAddress}>Save address</button>
            </div>
          </details>
        </section>

        <section className="panel">
          <h3>💳 Payment method</h3>
          <label className={`addr ${method === 'ONLINE' ? 'sel' : ''}`}>
            <input type="radio" checked={method === 'ONLINE'} onChange={() => setMethod('ONLINE')} />
            <div><b>Pay Online</b><div className="muted">Razorpay — UPI / Card / NetBanking</div></div>
          </label>
          <label className={`addr ${method === 'COD' ? 'sel' : ''}`}>
            <input type="radio" checked={method === 'COD'} onChange={() => setMethod('COD')} />
            <div><b>Cash on Delivery</b><div className="muted">Pay when your order arrives</div></div>
          </label>

          <h3 style={{ marginTop: 16 }}>🧾 Bill details</h3>
          <div className="bill flat">
            <div><span>Items total ({cart.count})</span><span>₹{cart.items_total}</span></div>
            <div><span>Delivery fee</span><span>{cart.delivery_fee === 0 ? 'FREE 🎉' : `₹${cart.delivery_fee}`}</span></div>
            {!!cart.savings && <div className="savings"><span>You save</span><span>₹{cart.savings}</span></div>}
            <div className="total"><span>To pay</span><span>₹{cart.total}</span></div>
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn green big" onClick={placeOrder} disabled={busy}>
            {busy ? 'Placing order…' : method === 'ONLINE' ? `Pay ₹${cart.total} & Place Order` : `Place Order · ₹${cart.total}`}
          </button>
        </section>
      </main>
    </div>
  );
}
