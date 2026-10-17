import nodemailer from 'nodemailer';

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
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;

  return nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

/**
 * Send real email to recipient using Nodemailer SMTP.
 * ONLY sends to the provided `to` address. No CC, no BCC, no admin copies.
 * Features automatic dual-port fallback (587 STARTTLS -> 465 SSL) to prevent timeout errors.
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

  // Attempt 1: Port 587 with STARTTLS (fastest and most universally open port)
  try {
    const transporter587 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });

    const info = await transporter587.sendMail({
      from,
      to: recipient,
      subject,
      text: text || html?.replace(/<[^>]+>/g, ''),
      html,
    });

    console.log(`[SMTP 587] Real email sent EXCLUSIVELY to recipient: ${recipient} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err587) {
    console.warn(`[SMTP 587 warning] ${err587.message}, falling back to port 465...`);

    // Attempt 2: Port 465 with direct SSL fallback
    try {
      const transporter465 = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });

      const info = await transporter465.sendMail({
        from,
        to: recipient,
        subject,
        text: text || html?.replace(/<[^>]+>/g, ''),
        html,
      });

      console.log(`[SMTP 465] Real email sent EXCLUSIVELY to recipient: ${recipient} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err465) {
      console.error(`[SMTP ERROR] Both port 587 and 465 failed for ${recipient}:`, err465.message);
      throw new Error(`Email delivery failed: ${err465.message || err587.message}`);
    }
  }
}
