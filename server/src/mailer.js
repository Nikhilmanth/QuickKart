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
  const host = (process.env.EMAIL_HOST || '').trim();
  const user = (process.env.EMAIL_USER || '').trim();
  // Strip any accidental spaces from Google App Passwords
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;

  // Use Gmail service if host contains gmail or if service=gmail or user ends with @gmail.com
  const isGmail =
    host.includes('gmail') ||
    (process.env.EMAIL_SERVICE || '').toLowerCase() === 'gmail' ||
    user.endsWith('@gmail.com');

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }

  return nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Send real email to recipient using Nodemailer SMTP.
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
  if (!isEmailConfigured()) {
    throw new Error(
      'Email SMTP is not configured. Please add your EMAIL_USER and EMAIL_PASS (e.g. Gmail App Password) to server/.env'
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
  const transporter = getEmailTransporter();

  try {
    const info = await transporter.sendMail({
      from,
      to: recipient, // ONLY the user's entered email
      subject,
      text: text || html?.replace(/<[^>]+>/g, ''),
      html,
    });

    console.log(`[SMTP] Real email sent EXCLUSIVELY to recipient: ${recipient} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[SMTP ERROR] Failed to send email to ${recipient}:`, err.message);
    throw new Error(`Email delivery failed: ${err.message}`);
  }
}
