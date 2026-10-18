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
  const hasGas = !!(process.env.GOOGLE_SCRIPT_URL || process.env.GMAIL_RELAY_URL);
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
  return hasGas || hasResend || hasBrevo || hasSmtp;
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
    connectionTimeout: 6000,
    greetingTimeout: 6000,
    socketTimeout: 8000,
  });
}

/**
 * Send real email to recipient using:
 * 1. Google Apps Script Webhook (Port 443 HTTPS - 100% Free, sends from user's Gmail)
 * 2. Resend HTTPS API (Port 443 HTTPS - 100% Free, 3000/mo)
 * 3. Brevo HTTPS API (Port 443 HTTPS - 100% Free, 300/day)
 * 4. Nodemailer Gmail SMTP (Direct Port 465 SSL / 587 TLS)
 * 
 * ONLY sends to the provided `to` address. No CC, no BCC, no admin copies.
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

  // 1. Google Apps Script Web App HTTPS Relay (Port 443 HTTPS - Never blocked by Render Free)
  const scriptUrl = (process.env.GOOGLE_SCRIPT_URL || process.env.GMAIL_RELAY_URL || '').trim();
  if (scriptUrl) {
    try {
      const res = await fetch(scriptUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          to: recipient,
          subject,
          html,
          text: text || html?.replace(/<[^>]+>/g, ''),
        }),
      });
      console.log(`[Google Apps Script HTTPS] Status ${res.status}. Real email dispatched to recipient: ${recipient}`);
      return { success: true, messageId: `gas-${Date.now()}` };
    } catch (errGas) {
      console.warn(`[Google Apps Script warning] ${errGas.message}, trying fallbacks...`);
    }
  }

  // 2. Resend HTTPS API (Works on Render Free Tier via Port 443)
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

  // 3. Brevo HTTPS API (Works on Render Free Tier via Port 443)
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
      'Email is not configured. Please add EMAIL_USER/EMAIL_PASS, GOOGLE_SCRIPT_URL, or RESEND_API_KEY to server/.env'
    );
  }

  let from = process.env.EMAIL_FROM || `QuickKart <${process.env.EMAIL_USER}>`;
  if (!from.includes('@')) {
    from = `QuickKart <${process.env.EMAIL_USER}>`;
  }

  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  // 4. Nodemailer standard service: 'gmail' (Instant on local, works when host unblocks SMTP)
  if (user.endsWith('@gmail.com') || (process.env.EMAIL_HOST || '').includes('gmail')) {
    try {
      const gmailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
      });

      const info = await gmailTransporter.sendMail({
        from,
        to: recipient,
        subject,
        text: text || html?.replace(/<[^>]+>/g, ''),
        html,
      });

      console.log(`[Nodemailer Gmail] Real email sent to recipient: ${recipient} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (errGmail) {
      console.warn(`[Nodemailer Gmail service warning] ${errGmail.message}, trying direct host...`);
    }
  }

  // 5. Direct host fallback (Port 465 / 587)
  let lastErr = null;
  const host = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
  for (const port of [465, 587]) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        family: 4,
        auth: { user, pass },
        tls: { servername: host, rejectUnauthorized: false },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
      });

      const info = await transporter.sendMail({
        from,
        to: recipient,
        subject,
        text: text || html?.replace(/<[^>]+>/g, ''),
        html,
      });

      console.log(`[SMTP ${port}] Real email sent to recipient: ${recipient} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (errPort) {
      lastErr = errPort;
      console.warn(`[SMTP ${port} warning]: ${errPort.message}`);
    }
  }

  const errText = String(lastErr?.message || 'SMTP Connection failed');
  if (/timeout|ETIMEDOUT|ESOCKET/i.test(errText)) {
    throw new Error(
      'Email delivery timed out. Cloud hosting provider (Render Free) blocks outbound SMTP ports 465/587. Please add GOOGLE_SCRIPT_URL or RESEND_API_KEY in Render environment dashboard.'
    );
  }

  throw new Error(`Email delivery failed: ${errText}`);
}


