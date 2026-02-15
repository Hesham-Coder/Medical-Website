function requireAuth(req, res, next) {
  if (req.app && req.app.locals && req.app.locals.sessionReady === false) {
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = {
  requireAuth,
};
