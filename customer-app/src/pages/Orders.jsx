import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useApp } from '../store.jsx';
import QuickKartLogo from '../components/QuickKartLogo.jsx';
import LocationPicker from '../components/LocationPicker.jsx';

export default function Orders() {
  const nav = useNavigate();
  const { user, cart, location } = useApp();
  const [orders, setOrders] = useState([]);
  const [cancelMsg, setCancelMsg] = useState('');
  const [showLoc, setShowLoc] = useState(false);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'addresses' | 'privacy'

  useEffect(() => {
    if (!user) {
      nav('/login');
      return;
    }
    api.get('/orders')
      .then((d) => setOrders(d.orders || []))
      .catch(() => {});
  }, [user]);

  const cancel = async (id) => {
    try {
      await api.post(`/orders/${id}/cancel`);
      setCancelMsg('Order cancelled successfully');
      const d = await api.get('/orders');
      setOrders(d.orders || []);
      setTimeout(() => setCancelMsg(''), 3000);
    } catch (e) {
      setCancelMsg(e.message);
    }
  };

  const logout = () => {
    setToken(null);
    window.location.href = '/';
  };

  const shortLoc = !location
    ? 'Select delivery address'
    : location.address.length > 28
    ? location.address.slice(0, 28) + '…'
    : location.address;

  const formatOrderTime = (isoString) => {
    try {
      const d = new Date(isoString + (isoString.endsWith('Z') ? '' : 'Z'));
      const day = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
      return `${day}, ${time}`;
    } catch {
      return isoString;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'DELIVERED':
        return 'Arrived in 10 minutes';
      case 'OUT_FOR_DELIVERY':
        return 'Arriving in 10 minutes 🛵';
      case 'PICKING':
        return 'Packing your fresh items 📦';
      case 'CONFIRMED':
        return 'Order Confirmed · Preparing ⚡';
      case 'CANCELLED':
        return 'Order Cancelled ❌';
      default:
        return 'Order Placed';
    }
  };

  return (
    <div className="app" style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* Authentic Blinkit Header */}
      <header className="header" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="brand" onClick={() => nav('/')} title="QuickKart">
          <QuickKartLogo size="md" showTagline={false} />
        </div>

        <button className="loc-block" onClick={() => setShowLoc(true)} title="Change delivery location">
          <div className="loc-title">⚡ 10 MINS DELIVERY</div>
          <div className="loc-sub">📍 {shortLoc} ▾</div>
        </button>

        <div className="search-wrap" onClick={() => nav('/')}>
          <span className="search-ico">🔍</span>
          <input
            className="search"
            readOnly
            placeholder='Search "sugar", "milk", "lays", "maggi"...'
            style={{ cursor: 'pointer' }}
          />
        </div>

        <div className="acct-wrap">
          <button className="btn ghost" onClick={() => nav('/orders')}>
            Account ▾
          </button>
        </div>

        <button className="btn green cart-btn" onClick={() => nav('/')}>
          🛒 {cart.count > 0 ? `${cart.count} item${cart.count === 1 ? '' : 's'} · ₹${cart.total}` : 'My Cart'}
        </button>
      </header>

      {/* Main Account & Orders Layout (Exact Blinkit Style) */}
      <div className="blinkit-account-container">
        {/* Left Sidebar */}
        <aside className="blinkit-sidebar">
          <div className="sidebar-user-card">
            <div className="sidebar-phone-pill">
              {user?.phone ? (user.phone.startsWith('+91') ? user.phone : `+91${user.phone}`) : user?.email || '+918003784724'}
            </div>
            {user?.name && <div className="sidebar-username">{user.name}</div>}
          </div>

          <nav className="sidebar-nav">
            <button
              className={`sidebar-link ${activeTab === 'addresses' ? 'active' : ''}`}
              onClick={() => { setActiveTab('addresses'); setShowLoc(true); }}
            >
              <span className="sidebar-icon">📍</span>
              <span>My Addresses</span>
            </button>

            <button
              className={`sidebar-link ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <span className="sidebar-icon">📦</span>
              <span>My Orders</span>
            </button>

            <button
              className={`sidebar-link ${activeTab === 'prescriptions' ? 'active' : ''}`}
              onClick={() => setActiveTab('prescriptions')}
            >
              <span className="sidebar-icon">💊</span>
              <span>My Prescriptions</span>
            </button>

            <button
              className={`sidebar-link ${activeTab === 'gift' ? 'active' : ''}`}
              onClick={() => setActiveTab('gift')}
            >
              <span className="sidebar-icon">🎁</span>
              <span>E-Gift Cards</span>
            </button>

            <button
              className={`sidebar-link ${activeTab === 'privacy' ? 'active' : ''}`}
              onClick={() => setActiveTab('privacy')}
            >
              <span className="sidebar-icon">🔒</span>
              <span>Account privacy</span>
            </button>

            <button className="sidebar-link logout-link" onClick={logout}>
              <span className="sidebar-icon">🚪</span>
              <span>Logout</span>
            </button>
          </nav>
        </aside>

        {/* Right Content Area: Orders List */}
        <main className="blinkit-orders-content">
          {cancelMsg && (
            <div className="toast-inline">
              ℹ️ {cancelMsg}
            </div>
          )}

          {activeTab === 'orders' && (
            <>
              {!orders.length && (
                <div className="empty-orders-card">
                  <div style={{ fontSize: '48px', marginBottom: '14px' }}>🛍️</div>
                  <h3>No orders placed yet</h3>
                  <p>Your grocery order history will show up here once you make your first purchase.</p>
                  <Link to="/" style={{ marginTop: '16px' }}>
                    <button className="btn green">Start Shopping →</button>
                  </Link>
                </div>
              )}

              {orders.map((o) => {
                const isDelivered = o.status === 'DELIVERED';
                const isCancelled = o.status === 'CANCELLED';
                const visibleItems = o.items.slice(0, 4);
                const extraCount = o.items.length - 4;

                return (
                  <div className="blinkit-order-card" key={o.id}>
                    {/* Header Row */}
                    <div className="blinkit-order-top" onClick={() => nav(`/track/${o.id}`)}>
                      <div className="status-row">
                        <span className={`status-circle-check ${isDelivered ? 'green' : isCancelled ? 'red' : 'yellow'}`}>
                          {isDelivered ? '✓' : isCancelled ? '✕' : '⚡'}
                        </span>
                        <b className="status-title">{getStatusText(o.status)}</b>
                      </div>
                      <span className="chevron-link">›</span>
                    </div>

                    {/* Subtitle: Price and Time */}
                    <div className="blinkit-order-sub">
                      ₹{o.total} • {formatOrderTime(o.created_at)}
                    </div>

                    {/* Product Packshots Row */}
                    <div className="packshot-row" onClick={() => nav(`/track/${o.id}`)}>
                      {visibleItems.map((item) => (
                        <div
                          className="packshot-box"
                          key={item.id || item.product_id}
                          title={`${item.name} x${item.qty}`}
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="packshot-img"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'block';
                              }}
                            />
                          ) : null}
                          <span
                            className="packshot-fallback"
                            style={{ display: item.image_url ? 'none' : 'block' }}
                          >
                            {item.icon || '📦'}
                          </span>
                        </div>
                      ))}

                      {extraCount > 0 && (
                        <div className="packshot-box extra-box" title={`${extraCount} more items`}>
                          +{extraCount}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="blinkit-order-footer">
                      <div className="order-badges-group">
                        <span className="order-id-badge">Order #{o.id}</span>
                        <span className="order-pm-badge">
                          {o.payment_method === 'ONLINE' ? '💳 Online' : '💵 Cash on Delivery'}
                        </span>
                        {o.delivery_otp && (o.status === 'OUT_FOR_DELIVERY' || o.status === 'PICKING') && (
                          <span className="otp-pill">
                            OTP: <b>{o.delivery_otp}</b>
                          </span>
                        )}
                      </div>

                      <div className="order-actions-group">
                        {['CONFIRMED', 'PICKING', 'OUT_FOR_DELIVERY'].includes(o.status) ? (
                          <>
                            <button
                              className="btn ghost small"
                              onClick={(e) => { e.stopPropagation(); cancel(o.id); }}
                            >
                              Cancel
                            </button>
                            <Link to={`/track/${o.id}`}>
                              <button className="btn green small">Track live 📍</button>
                            </Link>
                          </>
                        ) : (
                          <Link to={`/track/${o.id}`}>
                            <button className="btn ghost small">View Details →</button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {activeTab === 'prescriptions' && (
            <div className="empty-orders-card">
              <div style={{ fontSize: '48px', marginBottom: '14px' }}>💊</div>
              <h3>No Prescriptions Uploaded</h3>
              <p>Upload a doctor prescription to quickly reorder wellness essentials in 10 minutes.</p>
            </div>
          )}

          {activeTab === 'gift' && (
            <div className="empty-orders-card">
              <div style={{ fontSize: '48px', marginBottom: '14px' }}>🎁</div>
              <h3>QuickKart E-Gift Cards</h3>
              <p>Gift your friends and family instant groceries delivered in 10 minutes.</p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="empty-orders-card" style={{ textAlign: 'left', padding: '32px' }}>
              <h3>Account Privacy &amp; Data</h3>
              <p style={{ marginTop: '12px', color: '#64748b' }}>
                Your phone number, saved addresses, and payment references are protected with end-to-end encryption.
              </p>
              <div style={{ marginTop: '20px' }}>
                <button className="btn ghost" onClick={logout}>Sign Out from All Devices</button>
              </div>
            </div>
          )}
        </main>
      </div>

      {showLoc && <LocationPicker onClose={() => setShowLoc(false)} />}
    </div>
  );
}
