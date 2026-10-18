import nodemailer from 'nodemailer';
import dns from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

/**
 * Strict IPv4 DNS lookup to guarantee connection over IPv4
 * (prevents ENETUNREACH / connection timeouts on cloud Linux containers like Render)
 */
function lookupIPv4(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  return dns.lookup(hostname, { ...options, family: 4 }, callback);
}

export function isEmailConfigured() {
  const hasResend = !!(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim());
  const hasBrevo = !!(process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim());
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').trim();
  const hasSmtp = !!(
    user &&
    pass &&
    !/your_|placeholder|change_me/i.test(user) &&
    !/your_|placeholder|change_me/i.test(pass)
  );
  return hasResend || hasBrevo || hasSmtp;
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
    family: 4,
    lookup: lookupIPv4,
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
 * Send real email to recipient using Nodemailer SMTP, Resend API, or Brevo API.
 * ONLY sends to the provided `to` address. No CC, no BCC, no admin copies.
 * 
 * Supports:
 * 1. Resend HTTPS API (Port 443 - zero SMTP port blocking on Render)
 * 2. Brevo HTTPS API (Port 443 - zero SMTP port blocking on Render)
 * 3. Direct Gmail SMTP (Ports 465 / 587 with strict IPv4 enforcement)
 * 
 * @param {Object} options
 * @param {string} options.to - single recipient email address
 * @param {string} options.subject - email subject line
 * @param {string} [options.html] - HTML content
 * @param {string} [options.text] - Plain text content
 * @returns {Promise<{ success: boolean, messageId: string }>}
 */
export async function sendMail({ to, subject, html, text }) {
  // Ensure 'to' is strictly a single, clean email address string
  const recipient = String(to || '').trim().toLowerCase();
  if (!recipient || !recipient.includes('@')) {
    throw new Error('Invalid recipient email address');
  }

  // 1. Resend HTTPS API (Works on Render Free Tier via Port 443)
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
    try {
      const fromEmail = process.env.EMAIL_FROM || 'QuickKart <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipient],
          subject,
          html,
          text: text || html?.replace(/<[^>]+>/g, ''),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Resend delivery failed');
      console.log(`[Resend HTTPS] Real email sent to recipient: ${recipient} (Id: ${data.id})`);
      return { success: true, messageId: data.id };
    } catch (errResend) {
      console.warn(`[Resend warning] ${errResend.message}, trying fallbacks...`);
    }
  }

  // 2. Brevo HTTPS API (Works on Render Free Tier via Port 443)
  if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim()) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'QuickKart', email: process.env.EMAIL_USER || 'support@quickkart.com' },
          to: [{ email: recipient }],
          subject,
          htmlContent: html,
          textContent: text || html?.replace(/<[^>]+>/g, ''),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Brevo delivery failed');
      console.log(`[Brevo HTTPS] Real email sent to recipient: ${recipient} (Id: ${data.messageId})`);
      return { success: true, messageId: data.messageId };
    } catch (errBrevo) {
      console.warn(`[Brevo warning] ${errBrevo.message}, trying fallbacks...`);
    }
  }

  if (!isEmailConfigured()) {
    throw new Error(
      'Email is not configured. Please add your EMAIL_USER/EMAIL_PASS or RESEND_API_KEY to server/.env'
    );
  }

  let from = process.env.EMAIL_FROM || `QuickKart <${process.env.EMAIL_USER}>`;
  if (!from.includes('@')) {
    from = `QuickKart <${process.env.EMAIL_USER}>`;
  }

  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  let ipv4Host = 'smtp.gmail.com';
  try {
    const addresses = await dns.promises.resolve4('smtp.gmail.com');
    if (addresses && addresses.length > 0) {
      ipv4Host = addresses[0];
    }
  } catch (dnsErr) {
    console.warn('[DNS resolve4 fallback]:', dnsErr.message);
  }

  // Attempt 1: Port 465 (Direct SSL) with strict IPv4 address
  try {
    const transporter465 = nodemailer.createTransport({
      host: ipv4Host,
      port: 465,
      secure: true,
      auth: { user, pass },
      tls: {
        servername: 'smtp.gmail.com',
        rejectUnauthorized: false,
      },
      connectionTimeout: 12000,
      greetingTimeout: 12000,
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
        host: ipv4Host,
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user, pass },
        tls: {
          servername: 'smtp.gmail.com',
          rejectUnauthorized: false,
        },
        connectionTimeout: 12000,
        greetingTimeout: 12000,
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

