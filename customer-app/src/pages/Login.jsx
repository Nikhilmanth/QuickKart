import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useApp } from '../store.jsx';
import { initFirebase, sendPhoneOtp, confirmPhoneOtp } from '../firebase.js';

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

/** 
 * Segmented 6-box OTP input component matching Blinkit Image 2
 */
function SegmentedOtpInput({ length = 6, value, onChange, onComplete, disabled }) {
  const inputsRef = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const handleChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      const nextArr = digits.slice();
      nextArr[index] = '';
      const nextVal = nextArr.join('');
      onChange(nextVal);
      return;
    }
    const char = raw.slice(-1);
    const nextArr = digits.slice();
    nextArr[index] = char;
    const nextVal = nextArr.join('');
    onChange(nextVal);

    if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
    if (nextVal.length === length && onComplete) {
      onComplete(nextVal);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, length - 1);
    inputsRef.current[focusIdx]?.focus();
    if (pasted.length === length && onComplete) {
      onComplete(pasted);
    }
  };

  return (
    <div className="blinkit-otp-grid" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digits[i]}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`blinkit-otp-box ${digits[i] ? 'filled' : ''}`}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
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
  const [devOtpHint, setDevOtpHint] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'terms' | 'privacy' | null
  const timerRef = useRef(null);

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
        setErr('Mobile SMS gateway is upgrading. Please use Email OTP instead!');
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
        const res = await api.post('/auth/email/send-otp', { email: trimmedEmail });
        if (res?.devCode) {
          setDevOtpHint(res.devCode);
        } else {
          setDevOtpHint('');
        }
      } else {
        await sendPhoneOtp(`+91${phone}`);
      }

      setStep('otp');
      setCode('');
      setOtpValidity(60); // 1-minute expiration timer
      setResendCooldown(30); // 30s cooldown for resend
    } catch (e) {
      console.error('Send OTP error:', e);
      if (authMethod === 'email') {
        setErr(e?.message || 'Failed to send email OTP. Please check your email and try again.');
      } else {
        setErr(firebaseError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify) => {
    const finalCode = (codeToVerify || code).trim();
    if (finalCode.length !== 6) {
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
          code: finalCode,
          name: name.trim() || undefined,
        });
      } else {
        const idToken = await confirmPhoneOtp(finalCode);
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

      setToken(sessionData.token);
      setUser(sessionData.user);
      nav('/');
    } catch (e) {
      console.error('Verify error:', e);
      if (authMethod === 'email') {
        setErr(e?.message || 'Invalid or expired OTP. Please check and try again.');
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

  const handleBackToInput = () => {
    setStep('input');
    setCode('');
    setErr('');
  };

  const isInputFilled = authMethod === 'email' ? email.includes('@') : phone.length === 10;

  return (
    <div className="login-wrap blinkit-login-wrap">
      <div className="blinkit-login-modal">
        {/* Back Arrow Button matching Blinkit Photo 1 & 2 */}
        <button
          type="button"
          className="blinkit-modal-back-btn"
          onClick={step === 'otp' ? handleBackToInput : () => nav('/')}
          title={step === 'otp' ? 'Back to login' : 'Back to Home'}
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>

        {step === 'input' ? (
          <>
            {/* App Icon Tile matching Blinkit Photo 1 */}
            <div className="blinkit-app-squircle" onClick={() => nav('/')} title="QuickKart">
              <span className="blinkit-app-icon-text">quickkart</span>
            </div>

            {/* Title & Subtitle matching Photo 1 */}
            <h1 className="blinkit-login-title">India's last minute app</h1>
            <p className="blinkit-login-subtitle">Log in or Sign up</p>

            {/* Quick Method Switch Tabs */}
            <div className="blinkit-auth-tabs">
              <button
                type="button"
                className={`blinkit-tab ${authMethod === 'email' ? 'active' : ''}`}
                onClick={() => switchMethod('email')}
              >
                ✉️ Email OTP
              </button>
              <button
                type="button"
                className={`blinkit-tab ${authMethod === 'phone' ? 'active' : ''}`}
                onClick={() => switchMethod('phone')}
              >
                📱 Mobile SMS
              </button>
            </div>

            {authMethod === 'email' ? (
              <div className="blinkit-form-body">
                {/* Email Input Field matching Photo 1 */}
                <div className="blinkit-input-wrap">
                  <div className="blinkit-input-prefix">✉️</div>
                  <input
                    type="email"
                    id="email-input"
                    className="blinkit-input-field"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (err) setErr('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && isInputFilled && handleSendOtp()}
                    autoFocus
                  />
                </div>

                <div className="blinkit-input-wrap" style={{ marginTop: 12 }}>
                  <input
                    type="text"
                    id="name-input"
                    className="blinkit-input-field"
                    placeholder="Your Name (Optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && isInputFilled && handleSendOtp()}
                  />
                </div>

                {err && <div className="blinkit-err-banner">{err}</div>}

                {/* Continue Button matching Photo 1 */}
                <button
                  type="button"
                  id="send-otp-btn"
                  className="blinkit-continue-btn"
                  disabled={busy || !isInputFilled}
                  onClick={handleSendOtp}
                >
                  {busy ? 'Sending OTP…' : 'Continue'}
                </button>
              </div>
            ) : (
              <div className="blinkit-form-body">
                {/* Mobile Input Field matching Photo 1 */}
                <div className="blinkit-input-wrap">
                  <div className="blinkit-input-prefix">+91</div>
                  <input
                    type="tel"
                    id="phone-input"
                    className="blinkit-input-field"
                    placeholder="Enter mobile number"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, ''));
                      if (err) setErr('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && isInputFilled && handleSendOtp()}
                    autoFocus
                  />
                </div>

                <div className="blinkit-input-wrap" style={{ marginTop: 12 }}>
                  <input
                    type="text"
                    className="blinkit-input-field"
                    placeholder="Your Name (Optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && isInputFilled && handleSendOtp()}
                  />
                </div>

                {!fbReady && (
                  <div className="blinkit-info-pill">
                    💡 SMS Gateway upgrading. Tap <strong>Email OTP</strong> above for instant verification!
                  </div>
                )}

                {err && <div className="blinkit-err-banner">{err}</div>}

                {/* Continue Button matching Photo 1 */}
                <button
                  type="button"
                  id="send-otp-btn"
                  className="blinkit-continue-btn"
                  disabled={busy || !isInputFilled}
                  onClick={handleSendOtp}
                >
                  {busy ? 'Sending OTP…' : 'Continue'}
                </button>
              </div>
            )}

            {/* Terms of Service & Privacy Policy matching Photo 1 */}
            <div className="blinkit-terms-text">
              By continuing, you agree to our{' '}
              <button type="button" className="link-inline" onClick={() => setActiveModal('terms')}>Terms of service</button>
              {' '}&amp;{' '}
              <button type="button" className="link-inline" onClick={() => setActiveModal('privacy')}>Privacy policy</button>
            </div>
          </>
        ) : (
          <>
            {/* Header matching Photo 2: "OTP Verification" */}
            <div className="blinkit-otp-header">
              <h2 className="blinkit-otp-title">OTP Verification</h2>
            </div>

            <p className="blinkit-otp-subtitle">
              We have sent a verification code to
              <span className="blinkit-otp-recipient">
                {authMethod === 'email' ? email : `+91-${phone}`}
              </span>
            </p>

            {devOtpHint && (
              <div style={{
                background: '#f0fdf4',
                border: '1.5px dashed #0c831f',
                borderRadius: 12,
                padding: '8px 14px',
                textAlign: 'center',
                margin: '0 auto 14px',
                maxWidth: 320,
              }}>
                <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>
                  💡 Verification Code: <strong style={{ letterSpacing: 2, fontSize: 15, color: '#0c831f' }}>{devOtpHint}</strong>
                </span>
              </div>
            )}

            {/* Segmented OTP Boxes matching Photo 2 */}
            <SegmentedOtpInput
              length={6}
              value={code}
              onChange={(val) => {
                setCode(val);
                if (err) setErr('');
              }}
              onComplete={(fullCode) => handleVerifyOtp(fullCode)}
              disabled={busy || otpValidity === 0}
            />

            {/* 1-Minute Expiration Notice */}
            {otpValidity === 0 && (
              <div className="blinkit-err-banner">
                ⚠️ OTP has expired (1 min limit). Tap "Resend Code" below for a fresh code.
              </div>
            )}

            {err && <div className="blinkit-err-banner">{err}</div>}

            {/* Resend Code Section matching Photo 2: "Resend Code (in 29 secs)" */}
            <div className="blinkit-resend-wrap">
              {resendCooldown > 0 ? (
                <span className="blinkit-resend-countdown">
                  Resend Code (in {resendCooldown} secs)
                </span>
              ) : (
                <button
                  type="button"
                  className="blinkit-resend-btn"
                  disabled={busy}
                  onClick={handleSendOtp}
                >
                  Resend Code
                </button>
              )}
            </div>

            {/* Verify & Continue Button */}
            <button
              type="button"
              id="verify-otp-btn"
              className="blinkit-continue-btn"
              style={{ marginTop: 22 }}
              disabled={code.length !== 6 || busy || otpValidity === 0}
              onClick={() => handleVerifyOtp()}
            >
              {busy ? 'Verifying…' : otpValidity === 0 ? 'OTP Expired' : 'Verify & Continue'}
            </button>
          </>
        )}
      </div>

      {/* Terms & Privacy Modals */}
      {activeModal && (
        <div className="qk-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="qk-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qk-info-modal-header">
              <h3>
                {activeModal === 'terms' ? '📜 Terms & Conditions' : '🔒 Privacy Policy'}
              </h3>
              <button
                className="qk-info-modal-close"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="qk-info-modal-body">
              {activeModal === 'terms' ? (
                <div className="qk-info-content">
                  <h4>QuickKart Terms of Service</h4>
                  <p>By accessing QuickKart or creating an account, you agree to our 10-minute grocery fulfillment terms, responsible OTP security, and pricing policies.</p>
                </div>
              ) : (
                <div className="qk-info-content">
                  <h4>QuickKart Privacy Policy</h4>
                  <p>Your phone, email, and address are strictly encrypted and used solely for instant grocery delivery. We never share or sell your personal data.</p>
                </div>
              )}
            </div>
            <div className="qk-info-modal-footer">
              <button className="btn green" style={{ width: '100%' }} onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
