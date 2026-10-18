import nodemailer from 'nodemailer';
import dns from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

export function isEmailConfigured() {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').trim();
  return !!(
    user &&
    pass &&
    !/your_|placeholder|change_me/i.test(user) &&
    !/your_|placeholder|change_me/i.test(pass)
  );
}

export function getEmailTransporter() {
  const host = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  const port = parseInt(process.env.EMAIL_PORT, 10) || 465;

  return nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: port,
    secure: port === 465,
    requireTLS: port !== 465,
    family: 4, // Strict IPv4 to prevent ENETUNREACH on cloud environments like Render
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

/**
 * Send real email to recipient using Nodemailer SMTP.
 * ONLY sends to the provided `to` address. No CC, no BCC, no admin copies.
 * Features strict IPv4 enforcement (family: 4) and dual-port fallback (465 SSL -> 587 STARTTLS)
 * to prevent cloud IPv6 ENETUNREACH and socket timeouts.
 * 
 * @param {Object} options
 * @param {string} options.to - single recipient email address
 * @param {string} options.subject - email subject line
 * @param {string} [options.html] - HTML content
 * @param {string} [options.text] - Plain text content
 * @returns {Promise<{ success: boolean, messageId: string }>}
 */
export async function sendMail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    throw new Error(
      'Email SMTP is not configured. Please add your EMAIL_USER and EMAIL_PASS to server/.env'
    );
  }

  // Ensure 'to' is strictly a single, clean email address string
  const recipient = String(to || '').trim().toLowerCase();
  if (!recipient || !recipient.includes('@')) {
    throw new Error('Invalid recipient email address');
  }

  let from = process.env.EMAIL_FROM || `QuickKart <${process.env.EMAIL_USER}>`;
  if (!from.includes('@')) {
    from = `QuickKart <${process.env.EMAIL_USER}>`;
  }

  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  // Attempt 1: Port 465 (Direct SSL) with strict IPv4 - fast & rock solid on Linux cloud hosts
  try {
    const transporter465 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      family: 4, // Enforce IPv4
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    const info = await transporter465.sendMail({
      from,
      to: recipient,
      subject,
      text: text || html?.replace(/<[^>]+>/g, ''),
      html,
    });

    console.log(`[SMTP 465 IPv4] Real email sent EXCLUSIVELY to recipient: ${recipient} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err465) {
    console.warn(`[SMTP 465 warning] ${err465.message}, falling back to port 587 IPv4...`);

    // Attempt 2: Port 587 (STARTTLS) with strict IPv4 fallback
    try {
      const transporter587 = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        family: 4, // Enforce IPv4
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const info = await transporter587.sendMail({
        from,
        to: recipient,
        subject,
        text: text || html?.replace(/<[^>]+>/g, ''),
        html,
      });

      console.log(`[SMTP 587 IPv4] Real email sent EXCLUSIVELY to recipient: ${recipient} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err587) {
      console.error(`[SMTP ERROR] Both port 465 and 587 failed for ${recipient}:`, err587.message);
      throw new Error(`Email delivery failed: ${err465.message || err587.message}`);
    }
  }
}

