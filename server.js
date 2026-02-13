/**
 * Main application server.
 * Serves: public website (/), admin dashboard (/dashboard.html), login (/login.html), and API.
 * Content and users are stored in data/ (single source of truth).
 */
const express = require('express');
const session = require('express-session');
const compression = require('compression');
const logger = require('./lib/logger');
const { initializeFiles } = require('./lib/contentStore');
const { securityHeaders, blockSensitivePaths } = require('./lib/security');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const {
  PORT,
  IS_PROD,
  SESSION_SECRET,
  WEBSITE_DIR,
  PUBLIC_DIR,
  ADMIN_DIR,
  UPLOADS_DIR,
} = require('./lib/config');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();

// HTTPS redirect in production (trust common reverse proxies)
if (IS_PROD) {
  app.use((req, res, next) => {
    const proto = req.get('x-forwarded-proto');
    if (proto === 'http') {
      return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
    }
    next();
  });
}

app.use(securityHeaders);
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

if (IS_PROD && !SESSION_SECRET) {
  logger.error('SESSION_SECRET is required in production. Set it in .env');
  process.exit(1);
}

app.use(session({
  secret: SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'cancercenter.sid',
  cookie: {
    secure: IS_PROD,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict',
  },
}));

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

async function startServer() {
  await initializeFiles();
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
