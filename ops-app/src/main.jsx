import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import Login from './Login.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import PartnerApp from './PartnerApp.jsx';
import './styles.css';

function Root() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('quickkart_ops_session') || localStorage.getItem('blinkit_ops_session') || 'null');
    } catch { return null; }
  });

  const saveSession = (s) => {
    if (s) {
      localStorage.setItem('quickkart_ops_session', JSON.stringify(s));
    } else {
      localStorage.removeItem('quickkart_ops_session');
      localStorage.removeItem('quickkart_ops_token');
      localStorage.removeItem('blinkit_ops_session');
      localStorage.removeItem('blinkit_ops_token');
    }
    setSession(s);
  };

  if (!session) return <Login onLogin={saveSession} />;
  if (session.role === 'ADMIN') return <AdminDashboard session={session} onLogout={() => saveSession(null)} />;
  return <PartnerApp session={session} onLogout={() => saveSession(null)} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);

// PWA: installable app on phones
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

