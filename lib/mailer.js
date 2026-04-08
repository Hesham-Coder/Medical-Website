/**
 * Email dispatch via Nodemailer SMTP.
 *
 * Required environment variables:
 *   SMTP_HOST              — SMTP server hostname (e.g. smtp.sendgrid.net)
 *   SMTP_USER              — SMTP username / API key identifier
 *   SMTP_PASS              — SMTP password / API key
 *   SMTP_FROM              — Sender address (e.g. "Cancer Center <no-reply@example.com>")
 *   CONTACT_RECIPIENT_EMAIL — Admin inbox that receives contact form submissions
 *
 * Optional:
 *   SMTP_PORT   — defaults to 587 (STARTTLS). Use 465 with SMTP_SECURE=true for implicit TLS.
 *   SMTP_SECURE — set to "true" to enable TLS on connect (port 465). Defaults to false.
 */
const nodemailer = require('nodemailer');
const logger = require('./logger');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || '';
const CONTACT_RECIPIENT = process.env.CONTACT_RECIPIENT_EMAIL || '';

function isConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM && CONTACT_RECIPIENT);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendContactEmails(contact) {
  if (!isConfigured()) {
    logger.warn('SMTP not configured — skipping contact email dispatch', {
      missing: [
        !SMTP_HOST && 'SMTP_HOST',
        !SMTP_USER && 'SMTP_USER',
        !SMTP_PASS && 'SMTP_PASS',
        !SMTP_FROM && 'SMTP_FROM',
        !CONTACT_RECIPIENT && 'CONTACT_RECIPIENT_EMAIL',
      ].filter(Boolean),
    });
    return;
  }

  const transporter = createTransporter();
  const { firstName, lastName, email, phone, concern, message, id, createdAt } = contact;
  const fullName = `${firstName} ${lastName}`;

  // Admin notification
  const adminText = [
    `New contact form submission — ${id}`,
    `Submitted: ${createdAt}`,
    '',
    `Name:    ${fullName}`,
    `Email:   ${email}`,
    `Phone:   ${phone}`,
    `Concern: ${concern}`,
    `Message:\n${message || '(none)'}`,
  ].join('\n');

  // Submitter confirmation
  const confirmText = [
    `Dear ${firstName},`,
    '',
    'Thank you for contacting us. We have received your message and will get back to you within 24 hours.',
    '',
    'If your matter is urgent, please call us directly.',
    '',
    'Best regards,',
    'The Cancer Center Team',
  ].join('\n');

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: CONTACT_RECIPIENT,
      replyTo: email,
      subject: `Contact Form: ${concern} — ${fullName}`,
      text: adminText,
    });
    logger.info('Admin contact notification sent', { contactId: id });
  } catch (err) {
    logger.error('Failed to send admin contact notification', { contactId: id, error: err.message });
    throw err;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: 'We received your message',
      text: confirmText,
    });
    logger.info('Submitter confirmation sent', { contactId: id, to: email });
  } catch (err) {
    // Non-fatal: admin email succeeded; log but do not propagate
    logger.warn('Failed to send submitter confirmation', { contactId: id, to: email, error: err.message });
  }
}

module.exports = { sendContactEmails };


