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
const { createSessionStore } = require('../lib/sessionStore');
const {
  PORT,
  IS_PROD,
  SESSION_SECRET,
  SESSION_MAX_AGE_MS,
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

// Session store (Redis)
const sessionStore = createSessionStore(session);
app.use(
  session({
    store: sessionStore,
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

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Export for Vercel
module.exports = app;
