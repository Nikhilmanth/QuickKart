import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { io } from 'socket.io-client';
import QuickKartLogo from './QuickKartLogo.jsx';

/** Delivery Partner app: online toggle + live GPS streaming + order lifecycle. */
export default function PartnerApp({ session, onLogout }) {
  const [partner, setPartner] = useState(null);
  const [data, setData] = useState({ available: [], mine: [], history: [] });
  const [otp, setOtp] = useState({});
  const [gps, setGps] = useState('idle'); // idle | on | denied
  const [msg, setMsg] = useState('');
  const watchId = useRef(null);
  const socketRef = useRef(null);
  const activeOrderIds = useRef(new Set());

  const load = () => api.get('/partner/orders').then(setData).catch((e) => setMsg(e.message));
  useEffect(() => {
    api.get('/partner/me').then((d) => setPartner(d.partner)).catch((e) => setMsg(e.message));
    load();
    socketRef.current = io('/', { path: '/socket.io' });
    return () => { socketRef.current?.disconnect(); if (watchId.current) navigator.geolocation.clearWatch(watchId.current); };
  }, []);

  // Keep socket rooms in sync with active orders
  useEffect(() => {
    const ids = new Set(data.mine.map((o) => o.id));
    activeOrderIds.current.forEach((id) => { if (!ids.has(id)) { /* leave happens server-side by room */ } });
    ids.forEach((id) => { if (!activeOrderIds.current.has(id)) socketRef.current?.emit('join_order', { orderId: id }); });
    activeOrderIds.current = ids;
  }, [data]);

  const toggleOnline = async () => {
    const d = await api.post('/partner/status', { online: partner.status !== 'ONLINE' });
    setPartner(d.partner);
    if (d.partner.status === 'ONLINE') startGps(); else stopGps();
  };

  const startGps = () => {
    if (!navigator.geolocation) return setGps('denied');
    setGps('on');
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        api.post('/partner/location', { lat, lng }).catch(() => {});
        data.mine.forEach((o) => socketRef.current?.emit('partner_location', { orderId: o.id, lat, lng }));
      },
      () => setGps('denied'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  };
  const stopGps = () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current); setGps('idle'); };

  const act = (path, body) => async (o) => {
    try {
      await api.post(`/partner/orders/${o.id}/${path}`, body || {});
      setMsg(`✅ Order #${o.id}: ${path} done`);
      load();
    } catch (e) { setMsg(`⚠️ ${e.message}`); }
  };

  const fmtAddr = (a) => `${a.line1}${a.city ? ', ' + a.city : ''}`;
  const OrderCard = ({ o, mode }) => (
    <div className="rowcard" key={o.id}>
      <div>
        <b>#{o.id}</b> · ₹{o.total} · {o.payment_method === 'COD' ? '💵 COD' : '✅ Paid'}
        <div className="dim">{o.items.map((i) => `${i.icon}${i.name}×${i.qty}`).join(', ')}</div>
        <div className="dim">📍 {fmtAddr(o.customer_address)}</div>
      </div>
      <div className="right">
        {mode === 'available' && <button className="btn" onClick={() => act('accept')(o)}>Accept 🛒</button>}
        {mode === 'picking' && <button className="btn" onClick={() => act('pickup')(o)}>Picked up 🛵</button>}
        {mode === 'ofd' && (
          <>
            <input className="otpin" inputMode="numeric" maxLength={4} placeholder="OTP"
                   value={otp[o.id] || ''} onChange={(e) => setOtp({ ...otp, [o.id]: e.target.value.replace(/\D/g, '') })} />
            <button className="btn" disabled={(otp[o.id] || '').length !== 4}
                    onClick={() => act('deliver', { otp: otp[o.id] })(o)}>Deliver ✅</button>
          </>
        )}
      </div>
    </div>
  );

  const online = partner?.status === 'ONLINE';
  return (
    <div className="app">
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <QuickKartLogo size="sm" subtitle="Rider" />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#475569' }}>· {partner?.name || 'Partner'}</span>
        </div>
        <span className={`badge ${online ? 'ok' : ''}`}>{online ? 'ONLINE 🟢' : 'OFFLINE ⚪'}</span>
        <span className="dim">{gps === 'on' ? '📡 GPS live' : gps === 'denied' ? '📡 GPS blocked' : ''}</span>
        <div className="spacer" />
        <button className={online ? 'out' : 'btn'} onClick={toggleOnline}>{online ? 'Go offline' : 'Go ONLINE'}</button>
        <button className="out" onClick={onLogout}>Logout</button>
      </header>
      {msg && <div className="flash" onClick={() => setMsg('')}>{msg}</div>}

      {!online && <div className="hintbox">👆 Go online to receive delivery requests. Your location is shared only while online.</div>}

      <h3 className="sect">🔔 New requests</h3>
      <main className="list">{online && data.available.map((o) => <OrderCard o={o} mode="available" key={o.id} />)}
        {online && !data.available.length && <div className="dim center">No new orders right now…</div>}</main>

      <h3 className="sect">📦 My deliveries</h3>
      <main className="list">
        {!data.mine.length && <div className="dim center">Nothing assigned yet</div>}
        {data.mine.map((o) => <OrderCard o={o} mode={o.status === 'PICKING' ? 'picking' : o.status === 'OUT_FOR_DELIVERY' ? 'ofd' : 'none'} key={o.id} />)}
      </main>

      <h3 className="sect">🕘 Recent history</h3>
      <main className="list">
        {data.history.map((o) => (
          <div className="rowcard done" key={o.id}>
            <div><b>#{o.id}</b> · ₹{o.total}<div className="dim">{new Date(o.created_at + 'Z').toLocaleString()}</div></div>
            <span className={`badge ${o.status === 'DELIVERED' ? 'ok' : ''}`}>{o.status}</span>
          </div>
        ))}
      </main>
    </div>
  );
}
