/**
 * sendEmail.js — sends one email through Gmail SMTP (nodemailer).
 *
 * Credentials come from .env (EMAIL_HOST/PORT/USER/PASS). If they are
 * missing or invalid the send is silently SKIPPED instead of throwing,
 * so the system still works in environments without email configured.
 */
const nodemailer = require('nodemailer');

// Send one email; resolves with {skipped:true} when email isn't configured.
const sendEmail = async ({ to, subject, text, html }) => {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

  // Skip quietly when email is not configured (e.g. local development).
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS || !emailRegex.test(EMAIL_USER)) {
    return { skipped: true, reason: 'Email credentials are not configured' };
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT),
    secure: Number(EMAIL_PORT) === 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  return transporter.sendMail({
    from: `"MediSync" <${EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
};

module.exports = sendEmail;
