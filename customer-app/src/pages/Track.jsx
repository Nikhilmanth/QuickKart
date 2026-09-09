import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { api } from '../api.js';
import QuickKartLogo from '../components/QuickKartLogo.jsx';

const STEPS = [
  ['CONFIRMED', '✅', 'Order confirmed'],
  ['PICKING', '📦', 'Items being packed'],
  ['OUT_FOR_DELIVERY', '🛵', 'On the way to you'],
  ['DELIVERED', '🎉', 'Delivered'],
];

export default function Track() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [pos, setPos] = useState(null); // live partner position
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const socketRef = useRef(null);

  // Poll order + join socket room
  useEffect(() => {
    let alive = true;
    const load = () => api.get(`/orders/${id}`).then((d) => alive && setOrder(d.order)).catch(() => {});
    load();
    const poll = setInterval(load, 5000);

    socketRef.current = io('/', { path: '/socket.io' });
    socketRef.current.emit('join_order', { orderId: Number(id) });
    socketRef.current.on('partner:location', ({ lat, lng }) => setPos({ lat, lng }));
    socketRef.current.on('order:update', () => load());

    return () => { alive = false; clearInterval(poll); socketRef.current?.disconnect(); };
  }, [id]);

  // Leaflet map
  useEffect(() => {
    if (!order) return;
    const dest = { lat: order.address.lat ?? 28.6139, lng: order.address.lng ?? 77.2090 };
    if (!mapRef.current) {
      const map = L.map('map').setView([dest.lat, dest.lng], 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map);
      L.marker([dest.lat, dest.lng]).addTo(map).bindPopup('🏠 You are here');
      mapRef.current = map;
    }
  }, [order]);

  // Partner marker
  useEffect(() => {
    if (!mapRef.current || !pos) return;
    if (!markerRef.current) markerRef.current = L.marker([pos.lat, pos.lng], { title: 'Delivery partner' }).addTo(mapRef.current);
    else markerRef.current.setLatLng([pos.lat, pos.lng]);
    markerRef.current.bindPopup(`🛵 ${order?.partner_name || 'Your rider'} is here`).openPopup();
    mapRef.current.setView([pos.lat, pos.lng], 14);
  }, [pos]);

  if (!order) return <div className="empty">Loading tracking…</div>;

  const stepIdx = STEPS.findIndex(([s]) => s === order.status);
  const eta = new Date(new Date(order.created_at + 'Z').getTime() + 10 * 60000);

  return (
    <div className="app">
      <header className="header">
        <div className="brand" onClick={() => (window.location.href = '/')} title="QuickKart">
          <QuickKartLogo size="md" />
        </div>
        <h3>Tracking Order #{order.id}</h3>
        <button className="btn ghost" onClick={() => history.back()}>← Back</button>
      </header>

      <div id="map" className="track-map" />

      <main className="checkout track-panel">
        <section className="panel">
          {order.status === 'CANCELLED' ? (
            <h2>❌ This order was cancelled</h2>
          ) : (
            <>
              <div className="eta">
                {order.status === 'DELIVERED'
                  ? <>🎉 Delivered{order.delivered_at ? ` at ${new Date(order.delivered_at + 'Z').toLocaleTimeString()}` : ''}</>
                  : <>Arriving by <b>{eta.toLocaleTimeString()}</b></>}
              </div>
              <ul className="steps">
                {STEPS.map(([key, icon, label], i) => (
                  <li key={key} className={i <= stepIdx ? 'done' : ''}>
                    <span className="dot">{icon}</span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
              {['PICKING', 'OUT_FOR_DELIVERY'].includes(order.status) && !pos && (
                <div className="hint">Waiting for rider's live location… (open the Partner app on your phone)</div>
              )}
              {order.partner_name && order.status !== 'DELIVERED' && (
                <div className="rider-card">
                  🛵 <b>{order.partner_name}</b> · {order.vehicle}
                  <a href={`tel:${order.partner_phone}`} className="btn ghost small">📞 Call</a>
                </div>
              )}
            </>
          )}
          <h4>Order items</h4>
          <div className="bill flat">
            {order.items.map((i) => (
              <div key={i.id}><span>{i.icon} {i.name} × {i.qty}</span><span>₹{i.price * i.qty}</span></div>
            ))}
            <div className="total"><span>Total ({order.payment_method}{order.payment_status === 'PAID' ? ' · Paid ✅' : ''})</span><span>₹{order.total}</span></div>
          </div>
        </section>
      </main>
    </div>
  );
}
