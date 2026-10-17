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

  const locIcon = location?.icon || (location?.isForSomeoneElse ? '👥' : location?.type === 'work' ? '🏢' : '🏠');
  const locLabel = location?.label || (location?.isForSomeoneElse ? location.recipientName : 'Home');
  const shortLoc = !location
    ? 'Select delivery address'
    : location.address.length > 25
    ? location.address.slice(0, 25) + '…'
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
    <div className="app blinkit-theme">
      {/* Header */}
      <header className="header blinkit-header">
        <div className="header-inner">
          <div className="brand" onClick={() => nav('/')} title="QuickKart — Groceries. Delivered Quickly.">
            <QuickKartLogo size="md" showTagline={false} />
          </div>

          <button className="blinkit-loc-btn" onClick={() => setShowLoc(true)} title="Change delivery location">
            <div className="blinkit-loc-title">Delivery in 10 minutes</div>
            <div className="blinkit-loc-subtitle">
              <span className="blinkit-loc-tag">{locIcon} {locLabel}</span>
              <span className="blinkit-loc-sep">-</span>
              <span className="blinkit-loc-addr">{shortLoc}</span>
              <span className="blinkit-loc-arrow">▾</span>
            </div>
          </button>

          <div className="blinkit-search-container">
            <span className="blinkit-search-glass">🔍</span>
            <input
              className="blinkit-header-search"
              placeholder='Search "rice", "milk", "lays", "maggi", "amul", "atta", "paneer"...'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="blinkit-search-clear-btn"
                onClick={() => setQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="header-actions">
            {user ? (
              <div className="acct-wrap">
                <button className="btn ghost blinkit-acct-btn" onClick={() => setShowAcct((s) => !s)}>
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
              <button className="btn ghost blinkit-acct-btn" onClick={() => nav('/login')}>
                Login
              </button>
            )}

            <button
              className="btn green blinkit-cart-btn"
              onClick={() => setShowCart(true)}
            >
              🛒 {cart.count > 0 ? `${cart.count} item${cart.count === 1 ? '' : 's'} · ₹${cart.total}` : 'My Cart'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Blinkit Container */}
      <div className="blinkit-main-wrap">
        {/* Main Hero Banner: Stock up on daily essentials */}
        <section className="blinkit-hero-banner">
          <div className="blinkit-hero-left">
            <h1 className="blinkit-hero-heading">Stock up on daily essentials</h1>
            <p className="blinkit-hero-sub">
              Get farm-fresh goodness &amp; a range of exotic fruits, vegetables, eggs &amp; more
            </p>
            <button className="blinkit-shop-now-btn" onClick={scrollToProducts}>
              Shop Now
            </button>
          </div>
          <div className="blinkit-hero-art">
            <span className="hero-emoji-basket">🥦🍎🥛🥚🥖</span>
          </div>
        </section>

        {/* 3 Promo Banners in a Row (Photo 3) */}
        <div className="blinkit-promo-grid">
          {/* Promo 1: Pharmacy */}
          <div className="blinkit-promo-card teal" onClick={() => selectCategoryByName('Pharmacy')}>
            <div className="blinkit-promo-info">
              <h3>Pharmacy at your doorstep!</h3>
              <p>Cough syrups, pain relief sprays &amp; more</p>
              <button className="blinkit-promo-btn" onClick={(e) => { e.stopPropagation(); selectCategoryByName('Pharmacy'); }}>
                Order Now
              </button>
            </div>
            <div className="blinkit-promo-art">💊🩹🧴</div>
          </div>

          {/* Promo 2: Pet care */}
          <div className="blinkit-promo-card amber" onClick={() => selectCategoryByName('Pet Care')}>
            <div className="blinkit-promo-info">
              <h3>Pet care supplies at your door</h3>
              <p>Food, treats, toys &amp; more</p>
              <button className="blinkit-promo-btn" onClick={(e) => { e.stopPropagation(); selectCategoryByName('Pet Care'); }}>
                Order Now
              </button>
            </div>
            <div className="blinkit-promo-art">🐶🐱🦴</div>
          </div>

          {/* Promo 3: Baby care */}
          <div className="blinkit-promo-card lavender" onClick={() => selectCategoryByName('Baby Care')}>
            <div className="blinkit-promo-info">
              <h3>No time for a diaper run?</h3>
              <p>Get baby care essentials</p>
              <button className="blinkit-promo-btn" onClick={(e) => { e.stopPropagation(); selectCategoryByName('Baby Care'); }}>
                Order Now
              </button>
            </div>
            <div className="blinkit-promo-art">👶🍼🧸</div>
          </div>
        </div>

        {/* Category tiles */}
        <div className="blinkit-cat-section">
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
    </div>

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
              <li><a href={import.meta.env.VITE_OPS_URL || "http://localhost:3001"} target="_blank" rel="noreferrer" style={{ color: '#059669', textDecoration: 'none', fontWeight: 600 }}>Partner & Ops Portal ↗</a></li>
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
