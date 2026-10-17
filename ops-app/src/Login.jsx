import React, { useEffect, useState, useRef } from 'react';
import { api, setToken } from './api.js';
import { initFirebase, sendPhoneOtp, confirmPhoneOtp } from './firebase.js';
import QuickKartLogo from './QuickKartLogo.jsx';

/** Map raw Firebase errors to friendly messages */
function firebaseError(e) {
  const m = String(e?.message || e?.code || e || '');
  if (m.includes('auth/invalid-phone-number')) return 'That mobile number looks invalid';
  if (m.includes('auth/too-many-requests')) return 'Too many attempts — wait a minute and retry';
  if (m.includes('auth/invalid-verification-code')) return 'Wrong OTP — check the SMS and try again';
  if (m.includes('auth/code-expired')) return 'OTP expired — tap resend below';
  if (m.includes('billing')) return 'Your Firebase project needs billing enabled to send SMS';
  if (m.includes('auth/network-request-failed')) return 'Network problem — check your internet';
  const clean = m.replace(/^Firebase:\s*/i, '').replace(/\(auth\/[^)]+\)\.?/i, '').trim();
  return clean || 'Something went wrong — try again';
}

/** Ops login: Admin or Delivery Partner portal with Email OTP & SMS OTP */
export default function Login({ onLogin }) {
  const [tab, setTab] = useState('ADMIN'); // 'PARTNER' | 'ADMIN'
  const [authMethod, setAuthMethod] = useState('email'); // 'email' | 'sms'
  const [step, setStep] = useState('input'); // 'input' | 'otp'

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [fbReady, setFbReady] = useState(false);
  const [fbChecking, setFbChecking] = useState(true);

  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpValidity, setOtpValidity] = useState(60);
  const timerRef = useRef(null);
  const otpInputRef = useRef(null);

  useEffect(() => {
    api.get('/health')
      .then((h) => {
        if (h.firebase && initFirebase(h.firebaseConfig)) {
          setFbReady(true);
        } else {
          setFbReady(false);
        }
      })
      .catch(() => {
        setFbReady(false);
      })
      .finally(() => setFbChecking(false));
  }, []);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown > 0) {
      timerRef.current = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendCooldown]);

  // Countdown timer for 1-minute OTP expiration
  useEffect(() => {
    if (step === 'otp' && otpValidity > 0) {
      const t = setTimeout(() => setOtpValidity(otpValidity - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [step, otpValidity]);

  // Focus OTP input on step transition
  useEffect(() => {
    if (step === 'otp' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  const validateInput = () => {
    if (authMethod === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim()) {
        setErr('Please enter your email address');
        return false;
      }
      if (!emailRegex.test(email.trim())) {
        setErr('Please enter a valid email address');
        return false;
      }
    } else {
      if (phone.length !== 10) {
        setErr('Please enter a valid 10-digit mobile number');
        return false;
      }
      if (!fbReady) {
        setErr('SMS OTP requires Firebase credentials in server/.env. Use Email OTP instead!');
        return false;
      }
    }
    return true;
  };

  const handleSendOtp = async () => {
    setErr('');
    if (!validateInput()) return;

    setBusy(true);

    try {
      if (authMethod === 'email') {
        const trimmedEmail = email.trim().toLowerCase();
        await api.post('/auth/email/send-otp', { email: trimmedEmail });
      } else {
        await sendPhoneOtp(`+91${phone}`);
      }

      setStep('otp');
      setOtpValidity(60); // 1-minute expiration timer
      setResendCooldown(30);
    } catch (e) {
      console.error('Ops send OTP error:', e);
      if (authMethod === 'email') {
        setErr(e?.message || 'Failed to send email OTP. Please check your email and SMTP settings.');
      } else {
        setErr(firebaseError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (code.length !== 6) {
      setErr('Please enter the complete 6-digit OTP');
      return;
    }

    setBusy(true);
    setErr('');

    try {
      let sessionData;
      if (authMethod === 'email') {
        const trimmedEmail = email.trim().toLowerCase();
        sessionData = await api.post('/auth/email/verify-otp', {
          email: trimmedEmail,
          code: code.trim(),
          role: tab,
          name: name.trim() || undefined,
        });
      } else {
        const idToken = await confirmPhoneOtp(code);
        sessionData = await api.post('/auth/firebase', {
          idToken,
          role: tab,
          name: name.trim() || undefined,
        });
      }

      if (tab === 'PARTNER' && sessionData.user?.role !== 'PARTNER') {
        throw new Error('Not a delivery partner account');
      }
      if (tab === 'ADMIN' && sessionData.user?.role !== 'ADMIN') {
        throw new Error('This account does not have Admin privileges');
      }

      setToken(sessionData.token);
      onLogin({
        token: sessionData.token,
        user: sessionData.user,
        role: sessionData.user.role,
      });
    } catch (e) {
      console.error('Ops verify error:', e);
      if (authMethod === 'email') {
        setErr(e?.message || 'Invalid or expired OTP. Please try again.');
      } else {
        if (/partner account|not an admin|privileges/i.test(String(e?.message))) {
          setErr(e.message);
        } else {
          setErr(firebaseError(e));
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const switchRole = (newRole) => {
    setTab(newRole);
    setStep('input');
    setCode('');
    setErr('');
  };

  const switchMethod = (method) => {
    setAuthMethod(method);
    setStep('input');
    setCode('');
    setErr('');
  };

  return (
    <div className="wrap">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <QuickKartLogo size="lg" subtitle="Ops" />
        </div>

        {/* Portal Role Tabs */}
        <div className="tabs">
          <button
            type="button"
            className={tab === 'ADMIN' ? 'on' : ''}
            onClick={() => switchRole('ADMIN')}
          >
            📊 Admin
          </button>
          <button
            type="button"
            className={tab === 'PARTNER' ? 'on' : ''}
            onClick={() => switchRole('PARTNER')}
          >
            🛵 Delivery Partner
          </button>
        </div>

        {/* Auth Method Sub-tabs */}
        {step === 'input' && (
          <div className="tabs" style={{ marginBottom: 4 }}>
            <button
              type="button"
              className={authMethod === 'email' ? 'on' : ''}
              style={{ padding: '7px 10px', fontSize: '13px' }}
              onClick={() => switchMethod('email')}
            >
              ✉️ Email OTP
            </button>
            <button
              type="button"
              className={authMethod === 'sms' ? 'on' : ''}
              style={{ padding: '7px 10px', fontSize: '13px' }}
              onClick={() => switchMethod('sms')}
            >
              📱 Mobile SMS <span className="tab-badge-soon">Soon</span>
            </button>
          </div>
        )}

        {step === 'input' ? (
          <>
            {authMethod === 'email' ? (
              <>
                <label>{tab === 'ADMIN' ? 'Admin Email' : 'Partner Email'}</label>
                <input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (err) setErr('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  autoFocus
                />

                <label>(Optional) Name</label>
                <input
                  type="text"
                  placeholder={tab === 'ADMIN' ? 'Admin User' : 'Partner Name'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                />

                {err && <div className="err">{err}</div>}

                <button
                  type="button"
                  className="btn"
                  disabled={busy || !email.trim()}
                  onClick={handleSendOtp}
                >
                  {busy ? 'Sending OTP…' : '✉️ Send Email OTP'}
                </button>
              </>
            ) : (
              <div className="coming-soon-card">
                <div className="coming-soon-icon-wrap">
                  <span className="coming-soon-icon">📲</span>
                </div>
                <div className="coming-soon-badge">
                  <span>🚀 Coming Soon</span>
                </div>
                <h3 className="coming-soon-title">Mobile SMS Login is Coming Soon!</h3>
                <p className="coming-soon-desc">
                  Carrier SMS gateway integration for {tab === 'ADMIN' ? 'Admin' : 'Delivery Partner'} portal is currently in development.
                </p>

                <div className="coming-soon-features">
                  <div className="coming-soon-feature-item">
                    <div className="coming-soon-icon-box">⚡</div>
                    <div>
                      <strong>Instant 10-Second SMS</strong>
                      <span>Direct carrier OTP for instant field login</span>
                    </div>
                  </div>
                  <div className="coming-soon-feature-item">
                    <div className="coming-soon-icon-box">💬</div>
                    <div>
                      <strong>WhatsApp OTP Alerts</strong>
                      <span>Real-time duty & order dispatch alerts</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={() => switchMethod('email')}
                >
                  ✉️ Use Email OTP (Active & Instant)
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <label style={{ textAlign: 'center', display: 'block', margin: '6px 0 4px' }}>
              Enter 6-digit OTP sent to <br />
              <strong style={{ color: '#1c1c1c' }}>
                {authMethod === 'email' ? email : `+91 ${phone}`}
              </strong>
            </label>

            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              {otpValidity > 0 ? (
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: otpValidity <= 15 ? '#ef4444' : '#059669',
                  background: otpValidity <= 15 ? '#fef2f2' : '#f0fdf4',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  ⏱️ Valid for: <strong>00:{otpValidity < 10 ? '0' : ''}{otpValidity}</strong>
                </span>
              ) : (
                <div style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#ef4444',
                  background: '#fef2f2',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #fecaca'
                }}>
                  ⚠️ OTP has expired (1 min limit). Click Resend OTP below.
                </div>
              )}
            </div>

            <input
              ref={otpInputRef}
              className="otp"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''));
                if (err) setErr('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && otpValidity > 0 && handleVerifyOtp()}
              autoFocus
            />

            {err && <div className="err">{err}</div>}

            <button
              type="button"
              className="btn"
              disabled={code.length !== 6 || busy || otpValidity === 0}
              onClick={handleVerifyOtp}
            >
              {busy ? 'Verifying…' : otpValidity === 0 ? 'OTP Expired — Resend Below' : `Log In to ${tab === 'ADMIN' ? 'Admin Portal' : 'Partner App'}`}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <button
                type="button"
                className="resend"
                onClick={() => {
                  setStep('input');
                  setCode('');
                  setErr('');
                }}
              >
                ← Change {authMethod === 'email' ? 'email' : 'number'}
              </button>

              <button
                type="button"
                className="resend"
                disabled={resendCooldown > 0 || busy}
                onClick={handleSendOtp}
                style={{ opacity: resendCooldown > 0 ? 0.6 : 1, cursor: resendCooldown > 0 ? 'default' : 'pointer' }}
              >
                {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend OTP'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
