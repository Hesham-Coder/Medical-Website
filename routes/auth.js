const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const { ADMIN_DIR, USERS_FILE } = require('../lib/config');
const { loginLimiter } = require('../lib/security');
const logger = require('../lib/logger');
const fs = require('fs').promises;

const router = express.Router();

router.get('/login.html', (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'login.html'));
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const usersData = await fs.readFile(USERS_FILE, 'utf8');
    const users = JSON.parse(usersData);
    const user = users[username];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user.username;
    res.json({ success: true, message: 'Login successful', redirect: '/dashboard.html' });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

router.get('/api/auth/check', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ authenticated: true, username: req.session.userId });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
