/**
 * CSRF Protection Middleware
 * 
 * Uses csrf-csrf library with double-submit cookies pattern for production-grade security.
 * Replaces deprecated csurf middleware.
 * 
 * Features:
 * - Double-submit cookie pattern (secure, session-independent)
 * - Automatic token generation
 * - XSS protection via SameSite cookies
 * - CSRF token validation on state-changing requests
 * - Works with Express and express-session
 */

const { doubleCsrf } = require('csrf-csrf');
const logger = require('../lib/logger');

const cookieName = process.env.NODE_ENV === 'production'
  ? '__Host-csrf-token'
  : 'csrf-token';

const csrfUtilities = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'development-csrf-secret-change-me',
  getSessionIdentifier: (req) => String(req.sessionID || (req.session && req.session.id) || 'anonymous-session'),
  cookieName,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 3600000,
  },
  size: 64,
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

const {
  doubleCsrfProtection: csrfProtectionMiddleware,
  generateCsrfToken,
} = csrfUtilities;

/**
 * Initialize CSRF protection middleware
 * Call this in server.js AFTER session middleware is configured
 * 
 * @param {Express.App} app - Express application instance
 * @returns {Object} Object with protection middleware and token generator
 */
function initCsrf(app) {
  logger.info('CSRF protection initialized with double-submit cookie pattern');

  return {
    protect: csrfProtectionMiddleware,

    getToken: (req, res, options) => {
      try {
        return generateCsrfToken(req, res, options);
      } catch (error) {
        logger.error('Error generating CSRF token', { error: error.message });
        return null;
      }
    },
  };
}

/**
 * Express middleware to attach CSRF token to request
 * This allows req.csrfToken() to work like csurf
 * 
 * Usage:
 *   app.use(attachCsrfToken());
 */
function attachCsrfToken() {
  return (req, res, next) => {
    if (typeof req.csrfToken !== 'function') {
      req.csrfToken = function csrfToken(options) {
        return generateCsrfToken(req, res, options);
      };
    }
    next();
  };
}

function doubleCsrfProtection() {
  return csrfProtectionMiddleware;
}

function generateToken(req, res, options) {
  return generateCsrfToken(req, res, options);
}

module.exports = {
  initCsrf,
  attachCsrfToken,
  doubleCsrfProtection,
  generateToken,
};
