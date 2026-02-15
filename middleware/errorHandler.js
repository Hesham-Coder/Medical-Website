const path = require('path');
const logger = require('../lib/logger');
const { WEBSITE_DIR, IS_PROD } = require('../lib/config');

function notFoundHandler(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404);
  res.sendFile(path.join(WEBSITE_DIR, '404.html'), (err) => {
    if (err) {
      res.type('html').send('<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>Page not found</h1><p><a href="/">Return home</a></p></body></html>');
    }
  });
}

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    error: err && err.message ? err.message : 'Unknown error',
    method: req.method,
    path: req.originalUrl || req.path,
    ...(IS_PROD ? {} : { stack: err && err.stack ? err.stack : '' }),
  });
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Server error' });
  }
  res.status(500);
  res.sendFile(path.join(WEBSITE_DIR, '500.html'), (e) => {
    if (e) {
      res.type('html').send('<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Something went wrong</h1><p>Please try again or call us.</p><p><a href="/">Return home</a></p></body></html>');
    }
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
