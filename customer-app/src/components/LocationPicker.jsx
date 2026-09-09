import React, { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/**
 * Lets the user pick a delivery location three ways:
 *  1. Browser GPS -> reverse-geocoded to a readable address (OpenStreetMap, free)
 *  2. Forward search ("kharjurla phagwara") -> tap a result
 *  3. Typed manually (no coordinates)
 */
export default function LocationPicker({ onClose }) {
  const { setLocation, showToast } = useApp();
  const [detecting, setDetecting] = useState(false);
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState('');

  // Debounced forward-geocode search
  useEffect(() => {
    if (tab !== 'search' || query.trim().length < 3) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`
        );
        setResults(await res.json());
      } catch { /* offline — ignore */ }
      setSearching(false);
    }, 450);
    return () => clearTimeout(t);
  }, [query, tab]);

  const finish = (loc, msg) => {
    setLocation(loc);
    showToast(msg);
    onClose();
  };

  const detect = () => {
    if (!navigator.geolocation) return showToast('Geolocation is not supported here');
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        let address = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        try {
          const res = await fetch(
            `${NOMINATIM}/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`
          );
          const d = await res.json();
          if (d.display_name) address = d.display_name;
        } catch { /* fall back to raw coordinates */ }
        finish(
          { label: 'Current location', address, lat: coords.latitude, lng: coords.longitude },
          'Using your current location 📍'
        );
      },
      (err) => {
        setDetecting(false);
        showToast(err.code === 1 ? 'Location permission denied' : `Could not locate you (${err.message})`);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const pick = (item) =>
    finish(
      { label: 'Current location', address: item.display_name, lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
      'Delivery location updated 📍'
    );

  const saveManual = () => {
    if (!manual.trim()) return showToast('Type your address first');
    finish({ label: 'My place', address: manual.trim(), lat: null, lng: null }, 'Address saved 📍');
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="loc-modal">
        <div className="drawer-head">
          <h3>Select delivery location</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <button className="loc-detect" onClick={detect} disabled={detecting}>
          📡 {detecting ? 'Locating you…' : 'Use my current location'}
        </button>

        <div className="tabs">
          <button className={tab === 'search' ? 'on' : ''} onClick={() => setTab('search')}>
            🔎 Search area
          </button>
          <button className={tab === 'manual' ? 'on' : ''} onClick={() => setTab('manual')}>
            ⌨️ Type manually
          </button>
        </div>

        {tab === 'search' ? (
          <>
            <input
              autoFocus
              placeholder='Try "law gate phagwara" or "Model Town"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && <div className="hint">Searching…</div>}
            {results.map((r) => (
              <div key={r.place_id} className="loc-result" onClick={() => pick(r)}>
                📍 {r.display_name}
              </div>
            ))}
            {!searching && query.trim().length >= 3 && !results.length && (
              <div className="hint center">No matches found</div>
            )}
            {query.trim().length < 3 && (
              <div className="hint">Type at least 3 characters · data © OpenStreetMap</div>
            )}
          </>
        ) : (
          <>
            <textarea
              rows={3}
              placeholder="House no, street, area, city…"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <button className="btn green big" onClick={saveManual}>Save address</button>
          </>
        )}
      </div>
    </>
  );
}
