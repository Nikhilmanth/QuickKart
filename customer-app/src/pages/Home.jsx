import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useApp } from '../store.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import QuickKartLogo from '../components/QuickKartLogo.jsx';

const SEARCH_ITEMS = [
  'paneer',
  'milk',
  'bread',
  'curd',
  'amul butter',
  'atta',
  'lays chips',
  'maggi noodles',
  'eggs',
  'ice cream',
  'chocolates',
  'cold drinks',
  'fresh fruits',
];

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
  const [activeModal, setActiveModal] = useState(null); // 'help' | 'terms' | 'privacy' | 'perks' | null
  const [tickerIndex, setTickerIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const productsRef = useRef(null);

  // Blinkit-style placeholder auto-scroll upwards
  useEffect(() => {
    const t = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % SEARCH_ITEMS.length);
    }, 2600);
    return () => clearInterval(t);
  }, []);

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

          {/* Animated Blinkit Search Bar */}
          <div
            className={`blinkit-search-container ${isSearchFocused ? 'focused' : ''}`}
            onClick={() => searchInputRef.current?.focus()}
          >
            <span className="blinkit-search-glass" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input
              ref={searchInputRef}
              className="blinkit-header-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              aria-label="Search items"
            />
            {!query && (
              <div className="blinkit-ticker-container" aria-hidden="true">
                <span className="blinkit-ticker-prefix">Search</span>
                <span className="blinkit-ticker-clip">
                  <span key={tickerIndex} className="blinkit-ticker-item">
                    "{SEARCH_ITEMS[tickerIndex]}"
                  </span>
                </span>
              </div>
            )}
            {query && (
              <button
                className="blinkit-search-clear-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
                title="Clear search"
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
                    <div className="acct-menu blinkit-acct-menu">
                      <div className="acct-head">
                        <b>My Account</b>
                        <div className="muted">{user.phone ? (user.phone.startsWith('+91') ? user.phone : `+91${user.phone}`) : user.email || 'Customer'}</div>
                      </div>

                      <div className="acct-links-list">
                        <Link to="/orders" className="acct-item" onClick={() => setShowAcct(false)}>
                          <span className="acct-item-title">My Orders</span>
                        </Link>
                        <button className="acct-item" onClick={() => { setShowAcct(false); setShowLoc(true); }}>
                          <span className="acct-item-title">Saved Addresses</span>
                        </button>
                        <button className="acct-item" onClick={() => { setShowAcct(false); setActiveModal('prescriptions'); }}>
                          <span className="acct-item-title">My Prescriptions</span>
                        </button>
                        <button className="acct-item" onClick={() => { setShowAcct(false); setActiveModal('giftcards'); }}>
                          <span className="acct-item-title">E-Gift Cards</span>
                        </button>
                        <button className="acct-item" onClick={() => { setShowAcct(false); setActiveModal('help'); }}>
                          <span className="acct-item-title">FAQ's</span>
                        </button>
                        <button className="acct-item" onClick={() => { setShowAcct(false); setActiveModal('privacy'); }}>
                          <span className="acct-item-title">Account Privacy</span>
                        </button>
                        <button className="acct-item acct-logout-item" onClick={logout}>
                          <span className="acct-item-title">Log Out</span>
                        </button>
                      </div>

                      {/* Bottom QR Code Box matching Blinkit Photo 4 */}
                      <div className="acct-qr-tile">
                        <div className="acct-qr-code">
                          <svg width="50" height="50" viewBox="0 0 100 100" fill="#1e293b">
                            <rect width="100" height="100" fill="#ffffff" rx="8" />
                            <rect x="8" y="8" width="26" height="26" rx="4" fill="#0f172a" />
                            <rect x="13" y="13" width="16" height="16" rx="2" fill="#ffffff" />
                            <rect x="17" y="17" width="8" height="8" fill="#0c831f" />
                            <rect x="66" y="8" width="26" height="26" rx="4" fill="#0f172a" />
                            <rect x="71" y="13" width="16" height="16" rx="2" fill="#ffffff" />
                            <rect x="75" y="17" width="8" height="8" fill="#0c831f" />
                            <rect x="8" y="66" width="26" height="26" rx="4" fill="#0f172a" />
                            <rect x="13" y="71" width="16" height="16" rx="2" fill="#ffffff" />
                            <rect x="17" y="75" width="8" height="8" fill="#0c831f" />
                            <rect x="42" y="12" width="10" height="18" fill="#0f172a" />
                            <rect x="40" y="38" width="20" height="10" fill="#0f172a" />
                            <rect x="68" y="44" width="12" height="12" fill="#0c831f" />
                            <rect x="40" y="68" width="14" height="22" fill="#0f172a" />
                            <rect x="64" y="68" width="22" height="8" fill="#0f172a" />
                            <rect x="74" y="82" width="12" height="10" fill="#0c831f" />
                          </svg>
                        </div>
                        <div className="acct-qr-info">
                          <div className="acct-qr-headline">
                            Simple way to get groceries <span>at your doorstep</span>
                          </div>
                          <div className="acct-qr-sub">Scan the QR code and download QuickKart app</div>
                        </div>
                      </div>
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
              <li onClick={() => setActiveModal('perks')} style={{ cursor: 'pointer' }} title="Learn more about our 10-minute delivery guarantee">⚡ 10-Minute Instant Delivery</li>
              <li onClick={() => setActiveModal('perks')} style={{ cursor: 'pointer' }} title="Learn more about our quality produce">🌱 100% Quality Produce Guarantee</li>
              <li onClick={() => setActiveModal('perks')} style={{ cursor: 'pointer' }} title="Learn more about OTP secure handoff">🛡️ Contactless &amp; OTP Secure Delivery</li>
              <li onClick={() => setActiveModal('perks')} style={{ cursor: 'pointer' }} title="Learn more about payment options">💳 Cash on Delivery &amp; UPI / Cards</li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Customer Care</h4>
            <ul>
              <li onClick={() => setActiveModal('help')} style={{ cursor: 'pointer' }}>Help &amp; Support</li>
              <li onClick={() => setActiveModal('terms')} style={{ cursor: 'pointer' }}>Terms &amp; Conditions</li>
              <li onClick={() => setActiveModal('privacy')} style={{ cursor: 'pointer' }}>Privacy Policy</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div>© 2026 QuickKart Technologies Pvt. Ltd. All rights reserved.</div>
          <div style={{ color: '#059669', fontWeight: 700 }}>Groceries. Delivered Quickly. ⚡</div>
        </div>
      </footer>

      {/* Info Modals (Help, Terms, Privacy, Perks) */}
      {activeModal && (
        <div className="qk-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="qk-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qk-info-modal-header">
              <h3>
                {activeModal === 'help' && '🎧 Help & 24x7 Customer Support'}
                {activeModal === 'terms' && '📜 Terms & Conditions'}
                {activeModal === 'privacy' && '🔒 Privacy & Data Policy'}
                {activeModal === 'perks' && '✨ QuickKart Perks & Guarantees'}
                {activeModal === 'prescriptions' && '💊 My Prescriptions'}
                {activeModal === 'giftcards' && '🎁 QuickKart E-Gift Cards & Balance'}
              </h3>
              <button
                className="qk-info-modal-close"
                onClick={() => setActiveModal(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="qk-info-modal-body">
              {activeModal === 'help' && (
                <div className="qk-info-content">
                  <div className="qk-info-badge">QuickKart 24/7 Care</div>
                  <h4>How can we help you today?</h4>
                  <p>Our customer experience team is always ready to ensure your groceries reach you fast, fresh, and hassle-free.</p>
                  
                  <div className="qk-faq-section">
                    <div className="qk-faq-item">
                      <b>⏱️ Where is my order?</b>
                      <p>You can track live order progress in the <strong>My Orders</strong> section under your account profile.</p>
                    </div>
                    <div className="qk-faq-item">
                      <b>📦 Damaged or missing item?</b>
                      <p>We offer instant, no-questions-asked refunds or replacement for any quality or missing item issue.</p>
                    </div>
                    <div className="qk-faq-item">
                      <b>💳 Payment or refund query?</b>
                      <p>UPI and card refunds are settled instantly back to your source account within 2-4 hours.</p>
                    </div>
                  </div>

                  <div className="qk-contact-cards">
                    <div className="qk-contact-card">
                      <span className="qk-contact-icon">📞</span>
                      <div>
                        <b>Call Support (Toll-Free)</b>
                        <div className="muted">1800-QUICK-KART (9 AM - 11 PM)</div>
                      </div>
                    </div>
                    <div className="qk-contact-card">
                      <span className="qk-contact-icon">✉️</span>
                      <div>
                        <b>Email Support</b>
                        <div className="muted">support@quickkart.com</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === 'terms' && (
                <div className="qk-info-content">
                  <div className="qk-info-badge">Legal &amp; Agreement</div>
                  <h4>QuickKart Terms of Service</h4>
                  <p>Last updated: October 2026. By accessing QuickKart apps or placing an order, you agree to these terms:</p>
                  <ul className="qk-legal-list">
                    <li><strong>10-Minute Delivery Promise:</strong> Estimated delivery times are computed based on hyperlocal dark store proximity and live traffic conditions. During extreme weather or festive peaks, minor buffer times may apply.</li>
                    <li><strong>Pricing &amp; Freshness:</strong> All produce prices are inclusive of applicable taxes. In the event of weight variations in fresh fruits/vegetables, you will only be charged for the actual packed quantity.</li>
                    <li><strong>Cancellations:</strong> Orders can be cancelled free of charge prior to dark store dispatch. Once out for delivery, cancellations are subject to partner routing.</li>
                    <li><strong>User Account:</strong> Users are responsible for safeguarding their login credentials and OTP codes. Never share your OTP with anyone, including delivery partners.</li>
                  </ul>
                </div>
              )}

              {activeModal === 'privacy' && (
                <div className="qk-info-content">
                  <div className="qk-info-badge">Your Privacy Matters</div>
                  <h4>Privacy &amp; Data Protection Policy</h4>
                  <p>At QuickKart, protecting your personal information and delivery privacy is our top priority.</p>
                  <ul className="qk-legal-list">
                    <li><strong>What We Collect:</strong> Only information essential to fulfilling your grocery orders: your delivery address, mobile/email for OTP authentication, and order history.</li>
                    <li><strong>No Spam &amp; No Third-Party Sales:</strong> We strictly never sell, rent, or trade your personal data to advertisers or third-party marketing companies.</li>
                    <li><strong>Secure One-Time Passwords:</strong> OTP verification codes are generated securely, transmitted through encrypted TLS channels, and expire within 60 seconds.</li>
                    <li><strong>Address Encryption:</strong> Your precise GPS location and saved addresses are stored encrypted and shared with assigned delivery partners only during active fulfillment.</li>
                  </ul>
                </div>
              )}

              {activeModal === 'perks' && (
                <div className="qk-info-content">
                  <div className="qk-info-badge">The QuickKart Advantage</div>
                  <h4>Why Millions Choose QuickKart</h4>
                  <div className="qk-perks-grid">
                    <div className="qk-perk-card">
                      <div className="qk-perk-icon">⚡</div>
                      <div>
                        <b>10-Minute Hyperlocal Delivery</b>
                        <p>Our dedicated network of neighborhood micro-fulfillment dark stores ensures your essentials reach your doorstep in minutes.</p>
                      </div>
                    </div>
                    <div className="qk-perk-card">
                      <div className="qk-perk-icon">🌱</div>
                      <div>
                        <b>100% Quality Produce Guarantee</b>
                        <p>Direct farm sourcing, temperature-controlled cold chains, and strict freshness grading ensure you get only the finest items.</p>
                      </div>
                    </div>
                    <div className="qk-perk-card">
                      <div className="qk-perk-icon">🛡️</div>
                      <div>
                        <b>Safe &amp; Contactless OTP Delivery</b>
                        <p>Verified delivery partners and secure OTP authentication for complete peace of mind and handoff safety.</p>
                      </div>
                    </div>
                    <div className="qk-perk-card">
                      <div className="qk-perk-icon">💳</div>
                      <div>
                        <b>Flexible &amp; Zero-Fee Payments</b>
                        <p>Pay easily via Google Pay, PhonePe, Paytm, Cards, Net Banking, or choose Cash on Delivery at your doorstep.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === 'prescriptions' && (
                <div className="qk-info-content">
                  <div className="qk-info-badge">QuickKart Pharmacy</div>
                  <h4>My Medical Prescriptions</h4>
                  <p>Upload and manage doctor prescriptions for prescription-only medicines delivered in 10 minutes.</p>
                  
                  <div className="qk-upload-card" style={{ border: '2px dashed #0c831f', borderRadius: 16, padding: '24px 16px', textAlign: 'center', background: '#f0fdf4', margin: '16px 0' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                    <b style={{ color: '#0c831f', display: 'block', marginBottom: 4 }}>Upload New Prescription</b>
                    <p style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 12px' }}>Supports JPG, PNG, and PDF up to 10MB</p>
                    <label className="btn green" style={{ display: 'inline-block', padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}>
                      Choose File
                      <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={() => alert('Prescription uploaded successfully! Our certified pharmacist will verify it within 2 minutes.')} />
                    </label>
                  </div>

                  <div className="qk-faq-item">
                    <b>🛡️ 100% Certified &amp; Confidential</b>
                    <p>All prescriptions are verified by licensed registered pharmacists before medicine dispatch.</p>
                  </div>
                </div>
              )}

              {activeModal === 'giftcards' && (
                <div className="qk-info-content">
                  <div className="qk-info-badge">QuickKart Cash</div>
                  <h4>E-Gift Cards &amp; Store Credit</h4>
                  
                  <div style={{ background: 'linear-gradient(135deg, #0c831f 0%, #059669 100%)', color: '#ffffff', borderRadius: 16, padding: '20px 24px', margin: '16px 0', boxShadow: '0 8px 20px -4px rgba(12,131,31,0.3)' }}>
                    <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Available Balance</div>
                    <div style={{ fontSize: 32, fontWeight: 900, margin: '6px 0 12px' }}>₹0.00</div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>Linked to: {user?.phone || user?.email || 'Your Account'}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
                    <input
                      type="text"
                      placeholder="Enter 16-digit Gift Card / Coupon Code"
                      style={{ flex: 1, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13 }}
                    />
                    <button className="btn green" onClick={() => alert('Please enter a valid gift card or voucher code.')}>
                      Redeem
                    </button>
                  </div>

                  <div className="qk-faq-item">
                    <b>🎁 Send an E-Gift Card</b>
                    <p>Gift your friends and family instant groceries delivered in 10 minutes. Available in denominations of ₹250, ₹500, ₹1000, and ₹2000.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="qk-info-modal-footer">
              <button
                className="btn green"
                style={{ width: '100%', padding: '12px' }}
                onClick={() => setActiveModal(null)}
              >
                Got It, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
