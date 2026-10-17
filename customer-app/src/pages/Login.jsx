import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useApp } from '../store.jsx';
import { initFirebase, sendPhoneOtp, confirmPhoneOtp } from '../firebase.js';
import QuickKartLogo from '../components/QuickKartLogo.jsx';

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

export default function Login() {
  const nav = useNavigate();
  const { setUser } = useApp();
  
  const [authMethod, setAuthMethod] = useState('email'); // 'email' | 'phone'
  const [step, setStep] = useState('input'); // 'input' | 'otp'
  
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
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

  // Check Firebase health on mount (only necessary for SMS OTP)
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

  // Handle resend countdown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      timerRef.current = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendCooldown]);

  // Handle 1-minute OTP validity expiration countdown
  useEffect(() => {
    if (step === 'otp' && otpValidity > 0) {
      const t = setTimeout(() => setOtpValidity(otpValidity - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [step, otpValidity]);

  // Focus OTP input when transitioning to OTP step
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
      setResendCooldown(30); // 30s cooldown for resend
    } catch (e) {
      console.error('Send OTP error:', e);
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
          name: name.trim() || undefined,
        });
      } else {
        const idToken = await confirmPhoneOtp(code);
        sessionData = await api.post('/auth/firebase', {
          idToken,
          name: name.trim() || undefined,
        });
      }

      if (sessionData.user?.role === 'PARTNER') {
        throw new Error('This is a delivery partner account — please log in via the Ops partner portal');
      }

      if (!sessionData.token) {
        throw new Error('No authentication token received');
      }

      // Store session and update app store
      setToken(sessionData.token);
      setUser(sessionData.user);
      nav('/');
    } catch (e) {
      console.error('Verify error:', e);
      if (authMethod === 'email') {
        setErr(e?.message || 'Invalid or expired OTP. Please check your email and try again.');
      } else {
        if (/staff|partner account/i.test(String(e?.message))) {
          setErr(e.message);
        } else {
          setErr(firebaseError(e));
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const switchMethod = (method) => {
    setAuthMethod(method);
    setErr('');
    setCode('');
    setStep('input');
  };

  const handleBack = () => {
    setStep('input');
    setCode('');
    setErr('');
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand center" style={{ marginBottom: 16 }}>
          <QuickKartLogo size="xl" showTagline={true} />
        </div>

        {/* Method Toggle Tabs */}
        {step === 'input' && (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${authMethod === 'email' ? 'active' : ''}`}
              onClick={() => switchMethod('email')}
            >
              ✉️ Email OTP
            </button>
            <button
              type="button"
              className={`auth-tab ${authMethod === 'phone' ? 'active' : ''}`}
              onClick={() => switchMethod('phone')}
            >
              📱 Mobile SMS <span className="tab-badge-soon">Soon</span>
            </button>
          </div>
        )}

        {step === 'input' ? (
          <>
            {authMethod === 'email' ? (
              <>
                <h2>Groceries. Delivered Quickly.</h2>
                <label>Email Address</label>
                <input
                  type="email"
                  id="email-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (err) setErr('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  autoFocus
                />

                <label>(Optional) Your Name</label>
                <input
                  id="name-input"
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                />

                {err && <div className="err">{err}</div>}

                <button
                  id="send-otp-btn"
                  className="btn green big"
                  disabled={busy || !email.trim()}
                  onClick={handleSendOtp}
                >
                  {busy ? 'Sending OTP to your email…' : '✉️ Send Email OTP'}
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
                <h3 className="coming-soon-title">Mobile SMS OTP is Coming Soon!</h3>
                <p className="coming-soon-desc">
                  We are actively upgrading our telecom SMS gateway to deliver instantaneous login verification & WhatsApp alerts directly to your mobile phone.
                </p>

                <div className="coming-soon-features">
                  <div className="coming-soon-feature-item">
                    <div className="coming-soon-icon-box">⚡</div>
                    <div>
                      <strong>Instant 10-Second Delivery</strong>
                      <span>Direct carrier routes for lightning-fast SMS codes</span>
                    </div>
                  </div>
                  <div className="coming-soon-feature-item">
                    <div className="coming-soon-icon-box">💬</div>
                    <div>
                      <strong>WhatsApp OTP Integration</strong>
                      <span>Seamless 1-tap verification via official WhatsApp</span>
                    </div>
                  </div>
                  <div className="coming-soon-feature-item">
                    <div className="coming-soon-icon-box">🛡️</div>
                    <div>
                      <strong>SIM-Level Security</strong>
                      <span>Carrier-grade 2FA protection against account takeover</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn green big coming-soon-cta"
                  onClick={() => switchMethod('email')}
                >
                  ✉️ Use Email OTP Instead (Instant & Active)
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <h2>Enter Verification Code</h2>
            <p className="muted" style={{ textAlign: 'center', marginBottom: 10 }}>
              We've sent a 6-digit code to your inbox at <br />
              <strong style={{ color: '#1c1c1c' }}>
                {authMethod === 'email' ? email : `+91 ${phone}`}
              </strong>
            </p>

            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              {otpValidity > 0 ? (
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: otpValidity <= 15 ? '#ef4444' : '#059669',
                  background: otpValidity <= 15 ? '#fef2f2' : '#f0fdf4',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${otpValidity <= 15 ? '#fecaca' : '#bbf7d0'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  ⏱️ Code valid for: <strong>00:{otpValidity < 10 ? '0' : ''}{otpValidity}</strong>
                </span>
              ) : (
                <div style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#ef4444',
                  background: '#fef2f2',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #fecaca'
                }}>
                  ⚠️ OTP has expired (1 min limit). Click "Resend OTP" below for a fresh code.
                </div>
              )}
            </div>

            <input
              ref={otpInputRef}
              id="otp-input"
              className="otp-input"
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
              id="verify-otp-btn"
              className="btn green big"
              disabled={code.length !== 6 || busy || otpValidity === 0}
              onClick={handleVerifyOtp}
            >
              {busy ? 'Verifying…' : otpValidity === 0 ? 'OTP Expired — Resend Below' : 'Verify & Continue'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <button type="button" className="link" onClick={handleBack}>
                ← Change {authMethod === 'email' ? 'email' : 'number'}
              </button>

              <button
                type="button"
                className="link"
                disabled={resendCooldown > 0 || busy}
                onClick={handleSendOtp}
                style={{ opacity: resendCooldown > 0 ? 0.6 : 1, cursor: resendCooldown > 0 ? 'default' : 'pointer' }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
