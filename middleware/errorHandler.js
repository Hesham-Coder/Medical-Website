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
  // Provide safer, actionable API errors for common security/multipart failures.
  if (req.path && req.path.startsWith('/api/')) {
    // CSRF failures
    if (err && err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({ error: 'Security token invalid or missing. Refresh the page and try again.' });
    }

    // Multer upload failures
    if (err && (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE')) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Please upload a smaller file and try again.' });
      }
      return res.status(400).json({ error: 'Upload failed. Please try again.' });
    }

    // Common filesystem/storage failures (avoid leaking paths/details)
    if (err && (err.code === 'EACCES' || err.code === 'EPERM' || err.code === 'EROFS' || err.code === 'ENOSPC')) {
      return res.status(500).json({ error: 'Server storage is not writable. Check your hosting volume configuration and try again.' });
    }
  }

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
