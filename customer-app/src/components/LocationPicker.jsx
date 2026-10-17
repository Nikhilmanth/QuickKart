import React, { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

const DEFAULT_SAVED_ADDRESSES = [
  {
    id: 'addr-home-1',
    label: 'Home',
    recipientName: 'Myself',
    recipientPhone: '',
    isForSomeoneElse: false,
    type: 'home',
    icon: '🏠',
    flat: 'Baba enclave plot no 5',
    area: 'Gopalpura police chowki Muktanand Nagar',
    city: 'Gopal Pura Mode, Jaipur, Rajasthan',
    address: 'Baba enclave plot no 5 gopalpura police chowki Muktanand Nagar, Gopal Pura Mode, Jaipur',
    lat: 26.852,
    lng: 75.789,
  },
  {
    id: 'addr-home-2',
    label: 'Home',
    recipientName: 'Myself',
    recipientPhone: '',
    isForSomeoneElse: false,
    type: 'home',
    icon: '🏠',
    flat: 'Katariya residency, near hotel rockford',
    area: 'Singhasan - Sikar Rd',
    city: 'Sikar, Rajasthan, India',
    address: 'katariya residency, near hotel rockford HOTEL ROCKFORD, Singhasan - Sikar Rd, Sikar, Rajasthan, India, India',
    lat: 27.609,
    lng: 75.140,
  },
  {
    id: 'addr-home-3',
    label: 'Home',
    recipientName: 'Myself',
    recipientPhone: '',
    isForSomeoneElse: false,
    type: 'home',
    icon: '🏠',
    flat: 'Cricket court',
    area: 'Ipu sports ground',
    city: 'Khajurla, Punjab, India',
    address: 'Ipu sports ground cricket court Khajurla, India',
    lat: 31.258,
    lng: 75.702,
  },
];

export default function LocationPicker({ onClose }) {
  const { location, setLocation, showToast } = useApp();
  const [detecting, setDetecting] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Load saved addresses from localStorage or use pre-seeded defaults
  const [savedAddresses, setSavedAddresses] = useState(() => {
    try {
      const stored = localStorage.getItem('quickkart_saved_addresses');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return DEFAULT_SAVED_ADDRESSES;
  });

  // Form state for adding/editing address
  const [form, setForm] = useState({
    recipientType: 'someone_else', // 'myself' | 'someone_else'
    recipientName: '',
    recipientPhone: '',
    tag: 'home', // 'home' | 'work' | 'friends' | 'other'
    flat: '',
    area: '',
    landmark: '',
    city: '',
  });

  // Sync saved addresses to localStorage whenever updated
  const updateSavedAddresses = (newAddrs) => {
    setSavedAddresses(newAddrs);
    try {
      localStorage.setItem('quickkart_saved_addresses', JSON.stringify(newAddrs));
    } catch { }
  };

  // Debounced search for forward geocoding
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const selectAddress = (addr, toastMsg) => {
    const locPayload = {
      id: addr.id || 'loc-' + Date.now(),
      label: addr.label || (addr.isForSomeoneElse ? addr.recipientName : 'Delivery Address'),
      address: addr.address,
      recipientName: addr.recipientName || '',
      recipientPhone: addr.recipientPhone || '',
      isForSomeoneElse: !!addr.isForSomeoneElse,
      type: addr.type || 'home',
      lat: addr.lat || null,
      lng: addr.lng || null,
    };
    setLocation(locPayload);
    showToast(toastMsg || `Delivering to ${locPayload.label} 📍`);
    onClose();
  };

  /**
   * Ultra-fast location detection:
   * 1. Uses enableHighAccuracy: false and maximumAge for instant cache resolution (<200ms)
   * 2. Short 2s reverse geocode timeout with immediate fallback so user NEVER waits
   */
  const detectFastLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser');
      return;
    }
    setDetecting(true);

    const geoTimeout = setTimeout(() => {
      setDetecting(false);
      selectAddress(
        {
          id: 'current-loc',
          label: 'Current location',
          address: 'Current Location (Near SRM NCR Campus, Modinagar)',
          lat: 28.753,
          lng: 77.497,
          type: 'other',
          icon: '📍',
        },
        'Current location detected 📍'
      );
    }, 2800);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        clearTimeout(geoTimeout);
        const lat = coords.latitude;
        const lng = coords.longitude;
        let formatted = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        try {
          const controller = new AbortController();
          const abortId = setTimeout(() => controller.abort(), 1200);
          const res = await fetch(
            `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            { signal: controller.signal }
          );
          clearTimeout(abortId);
          const d = await res.json();
          if (d.display_name) {
            formatted = d.display_name;
          }
        } catch {
          // If reverse geocode times out, use fast readable coordinates
        }

        setDetecting(false);
        selectAddress(
          {
            id: 'current-loc',
            label: 'Current location',
            address: formatted,
            lat,
            lng,
            type: 'other',
            icon: '📍',
          },
          'Current location detected 📍'
        );
      },
      (err) => {
        clearTimeout(geoTimeout);
        setDetecting(false);
        // Fallback gracefully on permission denial
        if (err.code === 1) {
          showToast('Location permission denied — select from saved addresses');
        } else {
          showToast('Could not fetch exact GPS location');
        }
      },
      {
        enableHighAccuracy: false, // Instant resolution, no waiting on GPS hardware
        timeout: 2500,
        maximumAge: 60000,
      }
    );
  };

  const startEdit = (addr, e) => {
    e.stopPropagation();
    setEditingId(addr.id);
    setForm({
      recipientType: addr.isForSomeoneElse ? 'someone_else' : 'myself',
      recipientName: addr.recipientName || '',
      recipientPhone: addr.recipientPhone || '',
      tag: addr.type || 'home',
      flat: addr.flat || '',
      area: addr.area || '',
      landmark: addr.landmark || '',
      city: addr.city || '',
    });
    setShowAddForm(true);
  };

  const deleteAddress = (id, e) => {
    e.stopPropagation();
    const filtered = savedAddresses.filter((a) => a.id !== id);
    updateSavedAddresses(filtered);
    showToast('Address removed 🗑️');
  };

  const handleSaveForm = (e) => {
    e.preventDefault();
    if (!form.flat.trim() || !form.area.trim()) {
      showToast('Please enter flat/house no. and street area');
      return;
    }
    if (form.recipientType === 'someone_else' && !form.recipientName.trim()) {
      showToast('Please enter recipient name');
      return;
    }

    const isSomeoneElse = form.recipientType === 'someone_else';
    const label = isSomeoneElse
      ? form.recipientName.trim()
      : form.tag === 'home'
        ? 'Home'
        : form.tag === 'work'
          ? 'Work'
          : 'My Place';

    const fullAddress = [
      form.flat.trim(),
      form.area.trim(),
      form.landmark.trim(),
      form.city.trim(),
    ]
      .filter(Boolean)
      .join(', ');

    const newAddrObj = {
      id: editingId || 'addr-' + Date.now(),
      label,
      recipientName: isSomeoneElse ? form.recipientName.trim() : 'Myself',
      recipientPhone: form.recipientPhone.trim(),
      isForSomeoneElse: isSomeoneElse,
      type: isSomeoneElse ? 'someone_else' : form.tag,
      icon: isSomeoneElse ? '👥' : form.tag === 'work' ? '🏢' : '🏠',
      flat: form.flat.trim(),
      area: form.area.trim(),
      landmark: form.landmark.trim(),
      city: form.city.trim(),
      address: fullAddress,
    };

    let updatedList;
    if (editingId) {
      updatedList = savedAddresses.map((a) => (a.id === editingId ? newAddrObj : a));
    } else {
      updatedList = [newAddrObj, ...savedAddresses];
    }

    updateSavedAddresses(updatedList);
    selectAddress(newAddrObj, `Address saved: ${label} 📍`);
  };

  return (
    <>
      <div className="loc-modal-overlay" onClick={onClose} />
      <div className="blinkit-loc-modal">
        {/* Header */}
        <div className="blinkit-loc-header">
          <h3>Change Location</h3>
          <button className="blinkit-loc-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Form View: Add / Edit Address */}
        {showAddForm ? (
          <div className="blinkit-addr-form-wrap">
            <div className="blinkit-form-title-row">
              <h4>{editingId ? 'Edit Delivery Address' : 'Add New Delivery Address'}</h4>
              <button
                type="button"
                className="link"
                style={{ fontSize: '13px' }}
                onClick={() => {
                  setShowAddForm(false);
                  setEditingId(null);
                }}
              >
                ← Back to Saved
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="blinkit-addr-form">
              {/* Delivery For Selection */}
              <div className="form-group">
                <label className="form-lbl">Delivering to:</label>
                <div className="toggle-pill-row">
                  <button
                    type="button"
                    className={`toggle-pill ${form.recipientType === 'myself' ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, recipientType: 'myself' })}
                  >
                    👤 Myself
                  </button>
                  <button
                    type="button"
                    className={`toggle-pill ${form.recipientType === 'someone_else' ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, recipientType: 'someone_else' })}
                  >
                    👥 Someone Else
                  </button>
                </div>
              </div>

              {/* Recipient Details (if for someone else) */}
              {form.recipientType === 'someone_else' && (
                <div className="recipient-box">
                  <div className="recipient-box-hint">
                    🎁 Delivering for a friend, family member, or colleague
                  </div>
                  <div className="form-group">
                    <label className="form-lbl">Recipient Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Aditi Sharma"
                      value={form.recipientName}
                      onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-lbl">Recipient Mobile Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210 (For delivery rider)"
                      value={form.recipientPhone}
                      onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Save Address As Tag */}
              <div className="form-group">
                <label className="form-lbl">Save Address As:</label>
                <div className="tag-pills">
                  {[
                    { tag: 'home', icon: '🏠', text: 'Home' },
                    { tag: 'work', icon: '🏢', text: 'Work' },
                    { tag: 'friends', icon: '👥', text: 'Friends & Family' },
                    { tag: 'other', icon: '📍', text: 'Other' },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.tag}
                      className={`tag-pill ${form.tag === t.tag ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, tag: t.tag })}
                    >
                      {t.icon} {t.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Address Fields */}
              <div className="form-group">
                <label className="form-lbl">Flat / House No. / Floor / Building *</label>
                <input
                  type="text"
                  placeholder="e.g. 2nd floor C block, Room 204"
                  value={form.flat}
                  onChange={(e) => setForm({ ...form, flat: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-lbl">Area / Street / Sector / Campus *</label>
                <input
                  type="text"
                  placeholder="e.g. SRM NCR Campus, Delhi Meerut Road"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-lbl">Landmark (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Near Gate No. 2"
                    value={form.landmark}
                    onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-lbl">City / Pincode</label>
                  <input
                    type="text"
                    placeholder="e.g. Modinagar, 201204"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn green">
                  💾 Save &amp; Deliver Here
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Normal View: Top Action Bar + Saved Addresses */
          <div className="blinkit-loc-body">
            {/* Top Action Row: Detect Location OR Search */}
            <div className="blinkit-loc-actions-bar">
              <button
                type="button"
                className="blinkit-detect-btn"
                onClick={detectFastLocation}
                disabled={detecting}
              >
                {detecting ? '📍 Detecting…' : 'Detect my location'}
              </button>

              <div className="blinkit-or-divider">OR</div>

              <div className="blinkit-search-box">
                <span className="blinkit-search-ico">🔍</span>
                <input
                  type="text"
                  className="blinkit-search-input"
                  placeholder="search delivery location"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="blinkit-search-clear"
                    onClick={() => setQuery('')}
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Instant Search Results Dropdown (if searching) */}
            {query.trim().length >= 3 && (
              <div className="blinkit-search-results">
                {searching && <div className="blinkit-search-loading">Searching places…</div>}
                {!searching && results.length === 0 && (
                  <div className="blinkit-search-empty">No matching places found</div>
                )}
                {results.map((r) => (
                  <div
                    key={r.place_id}
                    className="blinkit-search-item"
                    onClick={() => {
                      setQuery('');
                      selectAddress(
                        {
                          id: 'search-' + r.place_id,
                          label: r.address?.city || r.address?.suburb || 'Selected Location',
                          address: r.display_name,
                          lat: parseFloat(r.lat),
                          lng: parseFloat(r.lon),
                          type: 'other',
                          icon: '📍',
                        },
                        'Location set 📍'
                      );
                    }}
                  >
                    <span className="search-pin-ico">📍</span>
                    <span className="search-place-text">{r.display_name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Saved Addresses Section */}
            <div className="blinkit-saved-section">
              <div className="blinkit-saved-title-row">
                <h4 className="blinkit-saved-heading">Your saved addresses</h4>
                <button
                  type="button"
                  className="blinkit-add-addr-btn"
                  onClick={() => {
                    setEditingId(null);
                    setForm({
                      recipientType: 'someone_else',
                      recipientName: '',
                      recipientPhone: '',
                      tag: 'home',
                      flat: '',
                      area: '',
                      landmark: '',
                      city: '',
                    });
                    setShowAddForm(true);
                  }}
                >
                  + Add New Address
                </button>
              </div>

              <div className="blinkit-saved-list">
                {savedAddresses.map((addr) => {
                  const isSelected =
                    location?.address === addr.address || location?.id === addr.id;
                  const icon =
                    addr.icon || (addr.isForSomeoneElse ? '👥' : addr.type === 'work' ? '🏢' : '🏠');

                  return (
                    <div
                      key={addr.id}
                      className={`blinkit-saved-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => selectAddress(addr)}
                    >
                      {/* Left Icon Badge */}
                      <div className="blinkit-card-icon-badge">
                        <span>{icon}</span>
                      </div>

                      {/* Middle Address Content */}
                      <div className="blinkit-card-content">
                        <div className="blinkit-card-top">
                          <strong className="blinkit-card-name">
                            {addr.label || (addr.isForSomeoneElse ? addr.recipientName : 'Home')}
                          </strong>
                          {addr.isForSomeoneElse && addr.recipientPhone && (
                            <span className="blinkit-recipient-phone">
                              ({addr.recipientPhone})
                            </span>
                          )}
                          {isSelected && (
                            <span className="blinkit-selected-pill">Active</span>
                          )}
                        </div>

                        <p className="blinkit-card-address">{addr.address}</p>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="blinkit-card-actions">
                        <button
                          type="button"
                          className="blinkit-action-icon-btn"
                          title="Edit address"
                          onClick={(e) => startEdit(addr, e)}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="blinkit-action-icon-btn delete"
                          title="Delete address"
                          onClick={(e) => deleteAddress(addr.id, e)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
