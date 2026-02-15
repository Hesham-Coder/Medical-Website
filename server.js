/**
 * Main application server.
 * Serves: public website (/), admin dashboard (/dashboard.html), login (/login.html), and API.
 * Content and users are stored in data/ (single source of truth).
 */
const fs = require('fs').promises;
const express = require('express');
const session = require('express-session');
const compression = require('compression');
const connectRedis = require('connect-redis');
const logger = require('./lib/logger');
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
} = require('./lib/config');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const RedisStoreCtor = connectRedis.default || connectRedis.RedisStore || connectRedis;
const app = express();
app.locals.sessionReady = false;
app.locals.redisClient = null;

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
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

if (!SESSION_SECRET) {
  logger.error('SESSION_SECRET is required. Set it in environment variables.');
  process.exit(1);
}

async function configureSession() {
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
      client: redisClient,
      prefix: 'sess:',
    });

    app.locals.redisClient = redisClient;
    app.locals.sessionReady = true;
    app.use(session({
      store: redisStore,
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: 'cancercenter.sid',
      cookie: {
        secure: IS_PROD,
        httpOnly: true,
        maxAge: SESSION_MAX_AGE_MS,
        sameSite: 'strict',
      },
    }));
    logger.info('Session store initialized with Redis');
  } catch (error) {
    app.locals.sessionReady = false;
    app.locals.redisClient = null;
    logger.error('Redis session initialization failed', { error: error.message });
    app.use((req, res, next) => {
      req.session = null;
      next();
    });
  }
}

app.get('/health', async (req, res) => {
  const checks = {
    redis: {
      ok: Boolean(app.locals.redisClient && app.locals.redisClient.isReady),
      message: app.locals.redisClient && app.locals.redisClient.isReady ? 'connected' : 'unavailable',
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

  const ok = checks.filesystem.dataDir && checks.filesystem.uploadsDir && checks.redis.ok;
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

  // Serve uploaded images with cache
  app.use('/uploads', express.static(UPLOADS_DIR, {
    maxAge: IS_PROD ? '1d' : 0,
    setHeaders: (res) => { if (IS_PROD) res.setHeader('Cache-Control', 'public, max-age=86400'); },
  }));

  // Serve only whitelisted static directories
  app.use('/assets', express.static(PUBLIC_DIR, { maxAge: IS_PROD ? '1d' : 0 }));
  app.use('/admin-static', express.static(ADMIN_DIR, { maxAge: IS_PROD ? '1d' : 0 }));
  app.use('/', express.static(WEBSITE_DIR, { maxAge: IS_PROD ? '1d' : 0 }));

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
  // Session middleware must be registered before the routes that use req.session.
  mountAppRoutes();
  app.listen(PORT, () => {
    logger.info('Server started', {
      port: PORT,
      website: `http://localhost:${PORT}/`,
      login: `http://localhost:${PORT}/login.html`,
      contactsApi: `http://localhost:${PORT}/api/contacts`,
    });
  });
}

startServer();
