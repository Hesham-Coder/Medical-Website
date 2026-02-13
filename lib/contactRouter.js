const nodemailer = require('nodemailer');
const logger = require('./logger');

function normalizeRoute(route) {
  if (!route || typeof route !== 'object') return { type: 'none', value: '' };
  return {
    type: String(route.type || 'none').toLowerCase(),
    value: String(route.value || '').trim(),
  };
}

function buildMessage(contact) {
  return [
    'New contact request',
    `Name: ${(contact.firstName || '')} ${(contact.lastName || '')}`.trim(),
    `Email: ${contact.email || ''}`,
    `Phone: ${contact.phone || ''}`,
    `Concern: ${contact.concern || ''}`,
    `Message: ${contact.message || ''}`,
    `ID: ${contact.id || ''}`,
    `Created: ${contact.createdAt || ''}`,
  ].join('\n');
}

async function sendEmailRoute(contact, value) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const to = value || process.env.SMTP_TO;

  if (!host || !user || !pass || !from || !to) {
    logger.warn('Email route skipped: missing SMTP config', { host: !!host, user: !!user, from: !!from, to: !!to });
    return { ok: false, reason: 'missing_smtp_config' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const message = buildMessage(contact);
  await transporter.sendMail({
    from,
    to,
    subject: 'New contact request',
    text: message,
  });
  return { ok: true };
}

async function sendUrlRoute(contact, value) {
  if (!/^https?:\/\//i.test(value)) return { ok: false, reason: 'invalid_url' };
  if (typeof fetch !== 'function') {
    logger.warn('URL route skipped: fetch not available');
    return { ok: false, reason: 'fetch_unavailable' };
  }
  const res = await fetch(value, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contact),
  });
  return { ok: res.ok, status: res.status };
}

function buildWhatsappRedirect(value, contact) {
  const phone = value.replace(/\D+/g, '');
  if (!phone) return null;
  const message = buildMessage(contact);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

async function routeContact(contact, route) {
  const normalized = normalizeRoute(route);
  if (!normalized.value || normalized.type === 'none') {
    return { type: 'none' };
  }

  if (normalized.type === 'email') {
    const result = await sendEmailRoute(contact, normalized.value);
    return { type: 'email', ...result };
  }

  if (normalized.type === 'url') {
    const result = await sendUrlRoute(contact, normalized.value);
    return { type: 'url', ...result };
  }

  if (normalized.type === 'whatsapp') {
    const redirectUrl = buildWhatsappRedirect(normalized.value, contact);
    return { type: 'whatsapp', redirectUrl };
  }

  return { type: 'none' };
}

module.exports = { routeContact };
