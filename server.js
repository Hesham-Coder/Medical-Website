/**
 * Main application server.
 * Serves: public website (/), admin dashboard (/dashboard.html), login (/login.html), and API.
 * Content and users are stored in data/ (single source of truth).
 */
const fs = require('fs').promises;
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const compression = require('compression');
const connectRedis = require('connect-redis');
const MemoryStore = require('express-session').MemoryStore;
const logger = require('./lib/logger');
const { brotliApiCompression } = require('./middleware/brotliCompression');
const { attachCsrfToken } = require('./middleware/csrf');
const { initializeFiles } = require('./lib/contentStore');
const { securityHeaders, blockSensitivePaths } = require('./lib/security');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { createRedisConnection } = require('./lib/redisClient');
const {
  PORT,
  IS_PROD,
  SESSION_SECRET,
  WEBSITE_DIR,
  PUBLIC_DIR,
  ADMIN_DIR,
  UPLOADS_DIR,
  DATA_DIR,
  SESSION_MAX_AGE_MS,
  REDIS_PREFIX,
  SERVICE_NAME,
} = require('./lib/config');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const RedisStoreCtor = connectRedis.default || connectRedis.RedisStore || connectRedis;
const app = express();
app.locals.sessionReady = false;
app.locals.redisClient = null;
app.locals.usingMemoryStore = false;

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

function setImmutableAssetHeaders(res, filePath) {
  const lowerPath = String(filePath || '').toLowerCase();
  if (/\.(css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|woff2?)$/.test(lowerPath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}

// Body / upload limits:
//   express.json / urlencoded : 100 KB
//   image uploads             : 5 MB  (imageUpload in routes/admin.js)
//   video uploads             : 120 MB default, env MAX_VIDEO_UPLOAD_MB overrides
//   restore backup upload     : 250 MB
function setUploadsHeaders(res, filePath) {
  const lowerPath = String(filePath || '').toLowerCase();
  // Images should be served inline so social crawlers and browsers can display them
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

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  logger.error('SESSION_SECRET is required and must be at least 32 characters. Set it in environment variables.');
  process.exit(1);
}

// Domain Identity Sanity Check (Critical for SEO & Canonical correctness)
const { SITE_URL } = require('./lib/config');
const EXPECTED_DOMAIN = 'waleedarafat.org';
if (SITE_URL.includes('comprehensivecancercenter.com')) {
  logger.warn('⚠️ DOMAIN IDENTITY MISMATCH DETECTED!');
  logger.warn(`Current SITE_URL: ${SITE_URL}`);
  logger.warn(`Expected Domain: ${EXPECTED_DOMAIN}`);
  logger.warn('Please update the SITE_URL environment variable to prevent SEO dilution and canonical errors.');
} else {
  logger.info(`Server Identity: ${SITE_URL}`);
}

async function configureSession() {
  // Derive a service-specific session cookie name and Redis session key prefix.
  // e.g. SERVICE_NAME=satt  → cookie "satt.sid", session keys "satt_sess:"
  //      SERVICE_NAME=medical → cookie "medical.sid", session keys "medical_sess:"
  const sessionCookieName = `${SERVICE_NAME}.sid`;
  const sessionKeyPrefix = `${REDIS_PREFIX}sess:`;

  try {
    const redisClient = createRedisConnection();
    let loggedRedisError = false;
    redisClient.on('error', (err) => {
      if (!loggedRedisError) {
        logger.error('Redis client error', { error: err.message });
        loggedRedisError = true;
      }
    });
    await redisClient.connect();

    const redisStore = new RedisStoreCtor({
      client: redisClient.raw,
      prefix: sessionKeyPrefix,
    });

    app.locals.redisClient = redisClient;
    app.locals.sessionReady = true;
    app.locals.usingMemoryStore = false;
    app.use(session({
      store: redisStore,
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: sessionCookieName,
      cookie: {
        secure: IS_PROD,
        httpOnly: true,
        maxAge: SESSION_MAX_AGE_MS,
        sameSite: 'strict',
      },
    }));
    logger.info('Session store initialized with Redis', {
      service: SERVICE_NAME,
      redisPrefix: REDIS_PREFIX,
      sessionKeyPrefix,
      cookieName: sessionCookieName,
    });
  } catch (error) {
    if (IS_PROD) {
      logger.error('Redis is required in production. Refusing to start with MemoryStore.', { error: error.message });
      process.exit(1);
    }
    app.locals.redisClient = null;
    app.locals.usingMemoryStore = true;
    app.locals.sessionReady = true;
    logger.warn('Redis session initialization failed; falling back to in-memory session store', {
      error: error.message,
      note: 'Sessions will not persist across server restarts. For production, configure Redis.',
    });
    app.use(session({
      store: new MemoryStore(),
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: sessionCookieName,
      cookie: {
        secure: IS_PROD,
        httpOnly: true,
        maxAge: SESSION_MAX_AGE_MS,
        sameSite: 'strict',
      },
    }));
    logger.info('Session store initialized with in-memory MemoryStore (fallback mode)', {
      service: SERVICE_NAME,
      cookieName: sessionCookieName,
    });
  }
}

app.get('/health', async (req, res) => {
  const checks = {
    redis: {
      ok: Boolean(app.locals.redisClient && app.locals.redisClient.isReady),
      message: app.locals.redisClient && app.locals.redisClient.isReady ? 'connected' : 'unavailable',
    },
    session: {
      ok: app.locals.sessionReady,
      mode: app.locals.usingMemoryStore ? 'memory (fallback)' : 'redis',
      message: app.locals.sessionReady ? 'initialized' : 'failed',
    },
    filesystem: {
      dataDir: false,
      uploadsDir: false,
    },
  };

  try {
    await fs.access(DATA_DIR);
    checks.filesystem.dataDir = true;
  } catch (error) {
    checks.filesystem.dataDir = false;
  }

  try {
    await fs.access(UPLOADS_DIR);
    checks.filesystem.uploadsDir = true;
  } catch (error) {
    checks.filesystem.uploadsDir = false;
  }

  const ok = checks.filesystem.dataDir && checks.filesystem.uploadsDir && checks.session.ok;
  res.status(200).json({
    status: ok ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks,
  });
});

function mountAppRoutes() {
  // Block access to sensitive paths before serving static files
  app.use(blockSensitivePaths);

  // Routes (before static)
  app.use(publicRoutes);
  app.use(authRoutes);
  app.use(adminRoutes);

  // Serve uploaded files — force download, block MIME sniffing
  app.use('/uploads', express.static(UPLOADS_DIR, {
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      setUploadsHeaders(res, filePath);
    },
  }));

  // Serve only whitelisted static directories
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

  // 404 and error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    error: reason && reason.message ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error && error.message ? error.message : String(error),
  });
});

async function startServer() {
  await initializeFiles();
  await configureSession();
  app.use(cookieParser());
  app.use(attachCsrfToken());
  // Session middleware must be registered before the routes that use req.session.
  mountAppRoutes();
  // Bind explicitly to all interfaces for PaaS environments (Railway/Render/etc).
  // Some platforms won't route traffic if the app binds only to localhost.
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    logger.info('Server started', {
      port: PORT,
      website: `http://localhost:${PORT}/`,
      login: `http://localhost:${PORT}/login.html`,
      contactsApi: `http://localhost:${PORT}/api/contacts`,
    });
  });
}

startServer();
