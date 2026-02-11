const logger = require('./logger');

/**
 * sendContactEmails(contact)
 *
 * In production, wire this up to your email provider (SendGrid, SES, etc.)
 * to deliver:
 * - An internal notification to the care coordination team
 * - An acknowledgment email to the patient
 *
 * For now, this is a safe no-op that simply logs the intent.
 */
async function sendContactEmails(contact) {
  try {
    logger.info('Contact email dispatch (stub)', {
      contactId: contact && contact.id,
      email: contact && contact.email,
    });
    // Place real email integration here in production.
  } catch (err) {
    logger.error('Contact email dispatch failed', { error: err.message });
  }
}

module.exports = { sendContactEmails };

