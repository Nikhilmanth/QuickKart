import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useApp } from '../store.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import QuickKartLogo from '../components/QuickKartLogo.jsx';

export default function Home() {
  const { user, cart, location, addToCart, updateQty } = useApp();
  const nav = useNavigate();
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState(''); // '' | 'price' | '-price'
  const [showCart, setShowCart] = useState(false);
  const [showLoc, setShowLoc] = useState(false);
  const [showAcct, setShowAcct] = useState(false);
  const productsRef = useRef(null);

  useEffect(() => {
    api.get('/catalog/categories').then((d) => setCategories(d.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (activeCat) p.set('category', activeCat);
      if (query) p.set('q', query);
      if (sortBy) p.set('sort', sortBy);
      api.get(`/catalog/products?${p}`).then((d) => setProducts(d.products || [])).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [activeCat, query, sortBy]);

  const qtyOf = (id) => cart.items.find((i) => (i.product_id ?? i.id) === id)?.qty || 0;

  const shortLoc = !location
    ? 'Select delivery address'
    : location.address.length > 28
    ? location.address.slice(0, 28) + '…'
    : location.address;

  const scrollToProducts = () => productsRef.current?.scrollIntoView({ behavior: 'smooth' });

  const selectCategoryByName = (search) => {
    const match = categories.find((c) => c.name.toLowerCase().includes(search.toLowerCase()));
    if (match) setActiveCat(match.id);
    else setActiveCat(null);
    scrollToProducts();
  };

  const logout = () => {
    setToken(null);
    window.location.href = '/';
  };

  const freeDeliveryDelta = Math.max(0, 199 - (cart.items_total || 0));
  const freeDeliveryProgress = Math.min(100, Math.round(((cart.items_total || 0) / 199) * 100));

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="brand" onClick={() => nav('/')} title="QuickKart — Groceries. Delivered Quickly.">
          <QuickKartLogo size="md" showTagline={false} />
        </div>

        <button className="loc-block" onClick={() => setShowLoc(true)} title="Change delivery location">
          <div className="loc-title">⚡ 10 MINS DELIVERY</div>
          <div className="loc-sub">📍 {shortLoc} ▾</div>
        </button>

        <div className="search-wrap">
          <span className="search-ico">🔍</span>
          <input
            className="search"
            placeholder='Search "milk", "lays", "maggi", "amul", "atta", "paneer"...'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="btn ghost small"
              style={{ padding: '0 8px', fontSize: '12px', border: 'none', background: 'transparent' }}
              onClick={() => setQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        {user ? (
          <div className="acct-wrap">
            <button className="btn ghost" onClick={() => setShowAcct((s) => !s)}>
              Account ▾
            </button>
            {showAcct && (
              <>
                <div className="menu-backdrop" onClick={() => setShowAcct(false)} />
                <div className="acct-menu">
                  <div className="acct-head">
                    <b>My Account</b>
                    <div className="muted">{user.name ? `${user.name} (${user.phone})` : user.phone}</div>
                  </div>
                  <Link to="/orders" onClick={() => setShowAcct(false)}>📦 My Orders</Link>
                  <button onClick={() => { setShowAcct(false); setShowLoc(true); }}>📍 Delivery Address</button>
                  <button onClick={logout}>🚪 Log Out</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button className="btn ghost" onClick={() => nav('/login')}>
            Login
          </button>
        )}

        <button
          className="btn green cart-btn"
          onClick={() => setShowCart(true)}
        >
          🛒 {cart.count > 0 ? `${cart.count} item${cart.count === 1 ? '' : 's'} · ₹${cart.total}` : 'My Cart'}
        </button>
      </header>

      {/* Hero + promo banners */}
      <div className="page-pad">
        <section className="hero-main">
          <div>
            <div className="hero-badge">⚡ Instant 10-Minute Delivery</div>
            <h1>Groceries. Delivered Quickly.</h1>
            <p>
              Farm-fresh fruits &amp; vegetables, pure Amul &amp; Mother Dairy products, munchies, cold beverages, and daily household staples delivered to your doorstep.
            </p>
            <button className="btn light" onClick={scrollToProducts}>
              Shop Fresh Essentials →
            </button>
          </div>
          <div className="hero-art">🥦🍎🥛⚡🥖</div>
        </section>

        {/* Quick commerce perks bar */}
        <div className="perks-bar">
          <div className="perk-item">
            <div className="perk-icon">⚡</div>
            <div className="perk-text">
              <b>10-Minute Delivery</b>
              <span>Express orders packed &amp; delivered fast</span>
            </div>
          </div>
          <div className="perk-item">
            <div className="perk-icon">🌱</div>
            <div className="perk-text">
              <b>100% Farm Fresh</b>
              <span>Directly sourced quality produce</span>
            </div>
          </div>
          <div className="perk-item">
            <div className="perk-icon">🛵</div>
            <div className="perk-text">
              <b>Free Delivery over ₹199</b>
              <span>No delivery charges on standard carts</span>
            </div>
          </div>
        </div>

        {/* Hero Category Highlights */}
        <div className="hero-row">
          <div className="promo emerald">
            <b>Fresh Fruits &amp; Veggies</b>
            <span>Kashmiri apples, bananas, potatoes, onions, tomatoes &amp; herbs</span>
            <button className="btn" onClick={() => selectCategoryByName('Vegetables')}>Explore Produce</button>
          </div>
          <div className="promo amber">
            <b>Dairy, Bread &amp; Eggs</b>
            <span>Amul Taaza, Gold Milk, butter, paneer, brown bread &amp; farm eggs</span>
            <button className="btn" onClick={() => selectCategoryByName('Dairy')}>Order Dairy</button>
          </div>
          <div className="promo rose">
            <b>Snacks &amp; Munchies</b>
            <span>Lay&apos;s Magic Masala, Kurkure, Haldiram&apos;s Bhujia &amp; Oreo cookies</span>
            <button className="btn" onClick={() => selectCategoryByName('Snacks')}>Browse Snacks</button>
          </div>
        </div>
      </div>

      {/* Category tiles */}
      <div className="page-pad">
        <div className="cat-section-header">
          <h2>Shop by Category</h2>
          <span className="muted" style={{ fontSize: '13px', fontWeight: 600 }}>{categories.length} aisles available</span>
        </div>
        <div className="cat-tiles">
          <button className={`cat-tile ${!activeCat ? 'active' : ''}`} onClick={() => setActiveCat(null)}>
            <span className="cat-ico">🛍️</span>
            <span>All Items</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`cat-tile ${activeCat === c.id ? 'active' : ''}`}
              onClick={() => setActiveCat(c.id)}
            >
              <span className="cat-ico">{c.icon || '📦'}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Title + Sorting */}
      <div className="catalog-header" ref={productsRef}>
        <div>
          <h2>{activeCat ? categories.find((c) => c.id === activeCat)?.name || 'Products' : 'Popular Products'}</h2>
          <span className="catalog-count">{products.length} product{products.length === 1 ? '' : 's'} available</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              fontWeight: 600,
              background: '#ffffff',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="">Sort by: Featured</option>
            <option value="price">Price: Low to High</option>
            <option value="-price">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      <main className="grid">
        {products.map((p) => {
          const discountPercent = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
          return (
            <div className="card" key={p.id}>
              <div className="card-img-wrap">
                {discountPercent > 0 && (
                  <span className="discount-badge">{discountPercent}% OFF</span>
                )}
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="card-img"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.card-img-fallback');
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="card-img-fallback" style={{ display: p.image_url ? 'none' : 'flex' }}>
                  {p.icon || '🛍️'}
                </div>
              </div>

              {p.brand && <div className="brand-badge">{p.brand}</div>}
              <div className="card-name" title={p.name}>{p.name}</div>

              <div className="unit-row">
                <span>{p.unit || 'Standard'}</span>
                <span className="rating-pill">★ {p.rating || 4.8}</span>
              </div>

              <div className="card-bottom">
                <div className="price-box">
                  <div className="price">₹{p.price}</div>
                  {p.mrp > p.price && <div className="mrp">₹{p.mrp}</div>}
                </div>

                {qtyOf(p.id) > 0 ? (
                  <div className="stepper">
                    <button onClick={() => updateQty(p.id, qtyOf(p.id) - 1)}>−</button>
                    <span>{qtyOf(p.id)}</span>
                    <button
                      disabled={p.stock <= qtyOf(p.id)}
                      onClick={() => updateQty(p.id, qtyOf(p.id) + 1)}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn add"
                    disabled={p.stock <= 0}
                    onClick={() => addToCart(p)}
                  >
                    {p.stock > 0 ? 'ADD' : 'OUT'}
                  </button>
                )}
              </div>

              {p.stock <= 20 && p.stock > 0 && (
                <div className="stock-low">Only {p.stock} left in stock!</div>
              )}
            </div>
          );
        })}
        {!products.length && (
          <div className="empty">
            <div>🔍 No products found matching your search.</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>Try searching for &quot;milk&quot;, &quot;lays&quot;, &quot;maggi&quot;, &quot;atta&quot;, or &quot;paneer&quot;.</div>
          </div>
        )}
      </main>

      {/* Cart drawer */}
      {showCart && (
        <>
          <div className="overlay" onClick={() => setShowCart(false)} />
          <aside className="drawer">
            <div className="drawer-head">
              <h3>My Cart ({cart.count})</h3>
              <button className="x" onClick={() => setShowCart(false)}>✕</button>
            </div>

            {!!cart.items.length && (
              <>
                <div className="drawer-strip">
                  ⚡ Delivery in 10 minutes · Shipment of {cart.count} item{cart.count === 1 ? '' : 's'}
                </div>

                {/* Free delivery milestone */}
                <div className="delivery-meter">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 700 }}>
                    <span>{cart.delivery_fee === 0 ? '🎉 Free Delivery unlocked!' : `Add ₹${freeDeliveryDelta} for FREE delivery`}</span>
                    <span>{freeDeliveryProgress}%</span>
                  </div>
                  <div className="delivery-meter-bar">
                    <div className="delivery-meter-fill" style={{ width: `${freeDeliveryProgress}%` }} />
                  </div>
                </div>
              </>
            )}

            {!cart.items.length && (
              <div className="empty" style={{ margin: 'auto 0' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🛒</div>
                <b>Your cart is empty</b>
                <div style={{ fontSize: '13px', marginTop: '6px', color: '#64748b' }}>
                  Explore authentic daily groceries &amp; fresh produce!
                </div>
              </div>
            )}

            <div className="cart-items-list">
              {cart.items.map((i) => {
                const itemId = i.product_id ?? i.id;
                return (
                  <div className="cart-row" key={itemId}>
                    {i.image_url ? (
                      <img
                        src={i.image_url}
                        alt={i.name}
                        className="mini-thumb"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="mini-fallback">{i.icon || '📦'}</div>
                    )}

                    <div className="grow">
                      <div className="item-name">{i.name}</div>
                      <div className="item-unit">{i.unit}</div>
                    </div>

                    <div className="stepper">
                      <button onClick={() => updateQty(itemId, i.qty - 1)}>−</button>
                      <span>{i.qty}</span>
                      <button onClick={() => updateQty(itemId, i.qty + 1)}>+</button>
                    </div>

                    <div className="item-price">₹{i.price * i.qty}</div>
                  </div>
                );
              })}
            </div>

            {!!cart.items.length && (
              <div className="bill">
                <div><span>Items total</span><span>₹{cart.items_total}</span></div>
                <div>
                  <span>Delivery fee</span>
                  <span>{cart.delivery_fee === 0 ? 'FREE 🎉' : `₹${cart.delivery_fee}`}</span>
                </div>
                {!!cart.savings && (
                  <div className="savings">
                    <span>You save</span>
                    <span>₹{cart.savings}</span>
                  </div>
                )}
                <div className="total"><span>To pay</span><span>₹{cart.total}</span></div>
                <button
                  className="btn green big"
                  onClick={() => {
                    setShowCart(false);
                    if (!user) {
                      nav('/login');
                    } else {
                      nav('/checkout');
                    }
                  }}
                >
                  {user ? `Proceed to Checkout · ₹${cart.total} →` : `Login to Checkout · ₹${cart.total} →`}
                </button>
              </div>
            )}
          </aside>
        </>
      )}

      {/* Location picker modal */}
      {showLoc && <LocationPicker onClose={() => setShowLoc(false)} />}

      {/* Footer */}
      <footer className="qk-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <QuickKartLogo size="md" showTagline={true} />
            <p>
              QuickKart delivers authentic, farm-fresh groceries, everyday staples, dairy, beverages, and household essentials in 10 minutes.
            </p>
          </div>
          <div className="footer-col">
            <h4>Popular Aisles</h4>
            <ul>
              <li onClick={() => selectCategoryByName('Vegetables')} style={{ cursor: 'pointer' }}>Vegetables &amp; Fruits</li>
              <li onClick={() => selectCategoryByName('Dairy')} style={{ cursor: 'pointer' }}>Dairy, Bread &amp; Eggs</li>
              <li onClick={() => selectCategoryByName('Snacks')} style={{ cursor: 'pointer' }}>Snacks &amp; Munchies</li>
              <li onClick={() => selectCategoryByName('Drinks')} style={{ cursor: 'pointer' }}>Cold Drinks &amp; Juices</li>
              <li onClick={() => selectCategoryByName('Atta')} style={{ cursor: 'pointer' }}>Atta, Rice, Oil &amp; Dals</li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>QuickKart Perks</h4>
            <ul>
              <li>⚡ 10-Minute Instant Delivery</li>
              <li>🌱 100% Quality Produce Guarantee</li>
              <li>🛡️ Contactless &amp; OTP Secure Delivery</li>
              <li>💳 Cash on Delivery &amp; UPI / Cards</li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Customer Care</h4>
            <ul>
              <li>Help &amp; Support</li>
              <li>Terms &amp; Conditions</li>
              <li>Privacy Policy</li>
              <li><a href="http://localhost:3001" target="_blank" rel="noreferrer" style={{ color: '#059669', textDecoration: 'none', fontWeight: 600 }}>Partner &amp; Ops Portal ↗</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div>© 2026 QuickKart Technologies Pvt. Ltd. All rights reserved.</div>
          <div style={{ color: '#059669', fontWeight: 700 }}>Groceries. Delivered Quickly. ⚡</div>
        </div>
      </footer>
    </div>
  );
}
