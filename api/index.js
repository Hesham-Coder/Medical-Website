/**
 * Vercel Serverless Function Handler
 * Wraps Express app for Vercel's serverless environment
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs').promises;

const logger = require('../lib/logger');
const { brotliApiCompression } = require('../middleware/brotliCompression');
const { attachCsrfToken } = require('../middleware/csrf');
const { securityHeaders, blockSensitivePaths } = require('../lib/security');
const { notFoundHandler, errorHandler } = require('../middleware/errorHandler');
const { createRedisConnection } = require('../lib/redisClient');
const connectRedis = require('connect-redis');
const MemoryStore = require('express-session').MemoryStore;

const {
  PORT,
  IS_PROD,
  SESSION_SECRET,
  SESSION_MAX_AGE_MS,
  WEBSITE_DIR,
  ADMIN_DIR,
} = require('../lib/config');

const publicRoutes = require('../routes/public');
const authRoutes = require('../routes/auth');
const adminRoutes = require('../routes/admin');

const app = express();

// Trust proxy for Vercel
if (IS_PROD) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

// HTTPS redirect
app.use((req, res, next) => {
  if (IS_PROD) {
    const proto = req.get('x-forwarded-proto');
    if (proto === 'http') {
      return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
    }
  }
  next();
});

// Security & Compression
app.use(securityHeaders);
app.use(brotliApiCompression());
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// Session Configuration
let sessionStore;
const RedisStoreCtor = connectRedis.default || connectRedis.RedisStore || connectRedis;

async function initializeSession() {
  try {
    // Try Redis first
    const redisClient = createRedisConnection();
    await new Promise((resolve, reject) => {
      redisClient.on('ready', resolve);
      redisClient.on('error', reject);
      setTimeout(reject, 5000); // 5 second timeout
    });
    
    sessionStore = new RedisStoreCtor({
      client: redisClient,
      prefix: 'sess:',
    });
    logger.info('✓ Redis session store initialized');
  } catch (err) {
    // Fallback to memory store
    logger.warn('⚠ Redis failed, using in-memory session store', { error: err.message });
    sessionStore = new MemoryStore();
  }
}

// Initialize session store (don't wait, just start it)
initializeSession().catch(err => {
  logger.error('Session initialization error', { error: err.message });
});

// Use in-memory store initially (will be replaced by Redis if available)
app.use(
  session({
    store: new MemoryStore(),
    secret: SESSION_SECRET || 'dev-secret-key',
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

// Update session store once Redis is ready
setTimeout(() => {
  if (sessionStore && !(sessionStore instanceof MemoryStore)) {
    app.use(
      session({
        store: sessionStore,
        secret: SESSION_SECRET || 'dev-secret-key',
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
  }
}, 2000);

app.use(attachCsrfToken());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes
app.use(blockSensitivePaths);
app.use(publicRoutes);
app.use(authRoutes);
app.use(adminRoutes);

// Static file serving
app.use('/assets', express.static(path.join(__dirname, '../public'), {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    const lower = (filePath || '').toLowerCase();
    if (/\.(css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|woff2?)$/.test(lower)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

app.use('/admin-static', express.static(path.join(__dirname, '../admin'), {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    const lower = (filePath || '').toLowerCase();
    if (lower.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (/\.(css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|woff2?)$/.test(lower)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    const lower = (filePath || '').toLowerCase();
    const isImage = /\.(jpe?g|png|gif|webp|avif|svg|ico)$/i.test(lower);
    if (!isImage) {
      res.setHeader('Content-Disposition', 'attachment');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

app.use('/', express.static(path.join(__dirname, '../website'), {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    const lower = (filePath || '').toLowerCase();
    if (lower.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (/\.(css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|woff2?)$/.test(lower)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
