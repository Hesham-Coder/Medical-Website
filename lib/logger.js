/**
 * Minimal logger used by the application.
 * In production you can replace this with a more advanced logger
 * (Winston, pino, etc.) without changing the rest of the codebase.
 */

const LEVELS = ['debug', 'info', 'warn', 'error'];

function log(level, message, meta) {
  if (!LEVELS.includes(level)) level = 'info';
  const time = new Date().toISOString();
  const base = { level, time, message };
  const line = meta && typeof meta === 'object'
    ? { ...base, ...meta }
    : base;
  // Keep output simple and JSON-structured for easy log collection
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

module.exports = {
  debug(message, meta) {
    log('debug', message, meta);
  },
  info(message, meta) {
    log('info', message, meta);
  },
  warn(message, meta) {
    log('warn', message, meta);
  },
  error(message, meta) {
    log('error', message, meta);
  },
};

