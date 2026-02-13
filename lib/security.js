const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { IS_PROD } = require('./config');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://www.googletagmanager.com", "'unsafe-inline'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "https:", "blob:"],
      frameSrc: ["https://www.google.com", "https://www.facebook.com", "https://facebook.com", "https://web.facebook.com"],
      connectSrc: ["'self'", "https://www.google-analytics.com", "https://www.googletagmanager.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      ...(IS_PROD && { upgradeInsecureRequests: [] }),
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
});

function blockSensitivePaths(req, res, next) {
  const blocked = ['/data', '/logs', '/.env', '/.git'];
  for (const b of blocked) {
    if (req.path === b || req.path.startsWith(b)) return res.status(403).send('Forbidden');
  }
  next();
}

module.exports = {
  loginLimiter,
  contactLimiter,
  securityHeaders,
  blockSensitivePaths,
};
