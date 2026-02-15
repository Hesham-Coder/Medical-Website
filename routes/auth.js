const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const csurf = require('csurf');
const { ADMIN_DIR } = require('../lib/config');
const { loginLimiter, credentialUpdateLimiter } = require('../lib/security');
const { requireAuth } = require('../middleware/auth');
const { validateCredentialUpdatePayload, sanitizeCredentialText } = require('../lib/validation');
const { audit } = require('../lib/audit');
const {
  getUserByUsername,
  sanitizePublicUser,
  updateLastLogin,
  updateCredentials,
} = require('../lib/userStore');
const logger = require('../lib/logger');

const router = express.Router();

function ensureSessionAvailable(req, res, next) {
  if (req.app && req.app.locals && req.app.locals.sessionReady === false) {
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
  next();
}

router.get('/login.html', (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'login.html'));
});

router.post('/login', ensureSessionAvailable, loginLimiter, async (req, res) => {
  try {
    const username = sanitizeCredentialText(req.body && req.body.username, 64);
    const password = String((req.body && req.body.password) || '');
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const userRow = await getUserByUsername(username);
    if (!userRow) return res.status(401).json({ error: 'Invalid credentials' });

    const passwordMatch = await bcrypt.compare(password, String(userRow.record.password || ''));
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = userRow.record.username;
    req.session.lastAuthAt = new Date().toISOString();
    await updateLastLogin(userRow.record.username, req.session.lastAuthAt);
    await audit('auth_login_success', { user: userRow.record.username });
    res.json({ success: true, message: 'Login successful', redirect: '/dashboard.html' });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', ensureSessionAvailable, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

router.get('/api/auth/check', ensureSessionAvailable, async (req, res) => {
  try {
    if (!(req.session && req.session.userId)) {
      return res.json({ authenticated: false });
    }
    const userRow = await getUserByUsername(req.session.userId);
    if (!userRow) return res.json({ authenticated: false });
    const profile = sanitizePublicUser(userRow.record);
    res.json({ authenticated: true, ...profile });
  } catch (error) {
    logger.error('Auth check error', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/api/user/update-credentials', ensureSessionAvailable, requireAuth, credentialUpdateLimiter, csurf(), async (req, res) => {
  try {
    const validation = validateCredentialUpdatePayload(req.body || {});
    if (!validation.success) {
      return res.status(validation.status || 400).json({ error: validation.error });
    }

    const result = await updateCredentials({
      currentUsername: req.session.userId,
      currentPassword: validation.data.currentPassword,
      newUsername: validation.data.newUsername || req.session.userId,
      newPassword: validation.data.newPassword,
    });

    if (result.status !== 200) {
      await audit('auth_update_credentials_failed', {
        user: req.session.userId || 'unknown',
        status: result.status,
      });
      return res.status(result.status).json({ error: result.error || 'Unable to update credentials' });
    }

    if (result.usernameChanged) {
      req.session.userId = result.user.username;
    }

    await audit('auth_update_credentials_success', {
      user: req.session.userId || 'unknown',
      usernameChanged: Boolean(result.usernameChanged),
      passwordChanged: Boolean(validation.data.newPassword),
    });

    res.json({
      success: true,
      message: 'Credentials updated successfully',
      user: result.user,
    });
  } catch (error) {
    logger.error('Credential update failed', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
