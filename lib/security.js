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

const credentialUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many credential update attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const restoreLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2,
  message: { error: 'Too many restore attempts. Please try again later.' },
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
      // 'unsafe-inline' removed from scriptSrc — use nonces for any inline scripts.
      // External CDNs and GTM are explicitly allowed.
      scriptSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        // Allow inline scripts already embedded in HTML (transitional).
        // TODO: replace all inline scripts with nonces and remove this.
        "'unsafe-inline'",
      ],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "https:", "blob:"],
      frameSrc: [
        "https://www.google.com",
        "https://www.facebook.com",
        "https://facebook.com",
        "https://web.facebook.com",
        "https://www.youtube.com",
        "https://youtube.com",
        "https://www.youtube-nocookie.com",
        "https://player.vimeo.com",
      ],
      connectSrc: ["'self'", "https://www.google-analytics.com", "https://www.googletagmanager.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      ...(IS_PROD && { upgradeInsecureRequests: [] }),
    },
  },
  // HSTS with preload — ensures all traffic over HTTPS, eligible for preload list
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
  credentialUpdateLimiter,
  restoreLimiter,
  contactLimiter,
  securityHeaders,
  blockSensitivePaths,
};
