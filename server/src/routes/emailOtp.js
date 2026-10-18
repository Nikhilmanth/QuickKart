import { Router } from 'express';
import crypto from 'crypto';
import { bad } from '../auth.js';
import { sendMail } from '../mailer.js';
import { sessionForIdentifier } from './auth.js';

const r = Router();
const OTP_TTL_MS = 1 * 60 * 1000; // 1 minute (60 seconds) validity

// In-memory store for email OTPs: Map<email, { code: string, expiresAt: number } >
const otpStore = new Map();

// Periodic cleanup of expired OTP entries every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (record.expiresAt <= now) {
      otpStore.delete(email);
    }
  }
}, 30 * 1000).unref();

/**
 * Helper to build branded QuickKart HTML email
 */
function buildOtpEmailHtml(code) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px 24px; border: 1px solid #eaeaea; border-radius: 16px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px;">Quick<span style="color: #f59e0b;">Kart</span></div>
        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b; font-weight: 600;">Groceries. Delivered Quickly.</p>
      </div>
      <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 8px; text-align: center;">Your Login Verification Code</h2>
      <p style="font-size: 14px; color: #475569; text-align: center; margin: 0 0 20px;">Use the following One-Time Password (OTP) to log in to your QuickKart account:</p>
      <div style="background: #f0fdf4; border: 2px dashed #059669; border-radius: 12px; padding: 18px; text-align: center; margin: 0 0 20px;">
        <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #059669; display: inline-block;">${code}</span>
      </div>
      <p style="font-size: 13px; color: #ef4444; text-align: center; margin: 0 0 16px; font-weight: 700;">⏱️ This code will expire in <strong>1 minute (60 seconds)</strong>. Do not share this code with anyone.</p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">If you did not request this login code, please ignore this email.</p>
    </div>
  `;
}

/**
 * POST /api/auth/email/send-otp
 * Body: { email }
 */
r.post('/send-otp', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    return bad(res, 'Email address is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return bad(res, 'Enter a valid email address');
  }

  try {
    // Generate secure 6-digit random code
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = Date.now() + OTP_TTL_MS;

    // Send real OTP email to user inbox via Nodemailer SMTP
    await sendMail({
      to: email,
      subject: `Your QuickKart Login OTP: ${code}`,
      text: `Your OTP for QuickKart login is ${code}. It will expire in 1 minute.`,
      html: buildOtpEmailHtml(code),
    });

    // Store in-memory for 1-minute validity
    otpStore.set(email, { code, expiresAt });

    res.json({
      success: true,
      message: 'OTP sent to your email (valid for 1 minute)',
      expiresInSeconds: 60,
    });
  } catch (err) {
    console.error('Error in send-otp route:', err.message);
    return bad(res, err.message || 'Failed to send email OTP. Please check your email and try again.');
  }
});

/**
 * POST /api/auth/email/verify-otp
 * Body: { email, code, name }
 */
r.post('/verify-otp', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const name = String(req.body?.name || '').trim();
  const role = req.body?.role ? String(req.body.role).trim().toUpperCase() : undefined;

  if (!email) {
    return bad(res, 'Email is required');
  }
  if (!code) {
    return bad(res, 'OTP code is required');
  }

  const record = otpStore.get(email);
  if (!record) {
    return bad(res, 'No active OTP found. Please request a new code.');
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return bad(res, 'OTP has expired (1 minute limit). Please request a new code.');
  }

  if (record.code !== code) {
    return bad(res, 'Invalid OTP. Please check the code in your email.');
  }

  // OTP verified successfully -> delete from store (one-time use only)
  otpStore.delete(email);

  // Issue session using shared session logic with role
  const session = sessionForIdentifier(email, { role, name });
  if (session.error) {
    return bad(res, session.error, session.code || 400);
  }

  res.json({
    success: true,
    token: session.token,
    user: session.user,
  });
});

export default r;