const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '..', 'data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.log');

/**
 * Minimal audit trail for sensitive actions (e.g., contact submissions).
 * Writes a single JSON line per event so it can be parsed or shipped to a SIEM.
 */
async function audit(event, details) {
  try {
    const record = {
      time: new Date().toISOString(),
      event,
      ...(details && typeof details === 'object' ? details : {}),
    };
    const line = JSON.stringify(record) + '\n';
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.appendFile(AUDIT_FILE, line, 'utf8');
  } catch (err) {
    // Do not break the main flow on audit failure; just log.
    logger.error('Audit write failed', { error: err.message });
  }
}

module.exports = { audit };

