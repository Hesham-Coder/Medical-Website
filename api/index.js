/**
 * Vercel Serverless Function - Main Entry Point
 * Routes all requests to Express app
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const compression = require('compression');
const helmet = require('helmet');
const logger = require('../lib/logger');
const { brotliApiCompression } = require('../middleware/brotliCompression');
const { attachCsrfToken } = require('../middleware/csrf');
const { securityHeaders, blockSensitivePaths } = require('../lib/security');
const { notFoundHandler, errorHandler } = require('../middleware/errorHandler');
const {
  PORT,
  IS_PROD,
  SESSION_SECRET,
  SESSION_MAX_AGE_MS,
  WEBSITE_DIR,
  PUBLIC_DIR,
  ADMIN_DIR,
  UPLOADS_DIR,
} = require('../lib/config');

const publicRoutes = require('../routes/public');
const authRoutes = require('../routes/auth');
const adminRoutes = require('../routes/admin');

const app = express();

if (IS_PROD) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  if (IS_PROD) {
    const proto = req.get('x-forwarded-proto');
    if (proto === 'http') {
      return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
    }
  }
  next();
});

app.use(securityHeaders);
app.use(brotliApiCompression());
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

function setImmutableAssetHeaders(res, filePath) {
  const lowerPath = String(filePath || '').toLowerCase();
  if (/\.(css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|woff2?)$/.test(lowerPath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}

function setUploadsHeaders(res, filePath) {
  const lowerPath = String(filePath || '').toLowerCase();
  const isImage = /\.(jpe?g|png|gif|webp|avif|svg|ico)$/i.test(lowerPath);
  if (!isImage) {
    res.setHeader('Content-Disposition', 'attachment');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
}

function setWebsiteHeaders(res, filePath) {
  const lowerPath = String(filePath || '').toLowerCase();
  if (lowerPath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache');
    return;
  }
  setImmutableAssetHeaders(res, filePath);
}

// Session store configuration (Redis with MemoryStore fallback)
const MemoryStore = session.MemoryStore;
let sessionStore;
if (process.env.REDIS_URL) {
  try {
    const { createSessionStore } = require('../lib/sessionStore');
    sessionStore = createSessionStore(session);
    logger.info('Session store initialized with Redis');
  } catch (err) {
    logger.error('Failed to initialize Redis session store, falling back to MemoryStore', { error: err.message });
    sessionStore = new MemoryStore();
  }
} else {
  logger.warn('REDIS_URL is not set. Falling back to in-memory session store (MemoryStore).');
  sessionStore = new MemoryStore();
}

app.use(
  session({
    store: sessionStore,
    secret: SESSION_SECRET || 'fallback-session-secret-for-vercel-deploy-freely',
    resave: false,
    saveUninitialized: false,
    name: 'cancercenter.sid',
    cookie: {
      secure: IS_PROD,
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_MS,
      sameSite: 'strict',
    },
  })
);

app.use(attachCsrfToken());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use(blockSensitivePaths);
app.use(publicRoutes);
app.use(authRoutes);
app.use(adminRoutes);

// Static file serving fallback
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    setUploadsHeaders(res, filePath);
  },
}));
app.use('/assets', express.static(PUBLIC_DIR, {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    setImmutableAssetHeaders(res, filePath);
  },
}));
app.use('/admin-static', express.static(ADMIN_DIR, {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    setWebsiteHeaders(res, filePath);
  },
}));
app.use('/', express.static(WEBSITE_DIR, {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    setWebsiteHeaders(res, filePath);
  },
}));

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Export for Vercel
module.exports = app;
