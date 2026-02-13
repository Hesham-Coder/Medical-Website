const express = require('express');
const path = require('path');
const csurf = require('csurf');
const multer = require('multer');
const { ADMIN_DIR, UPLOADS_DIR } = require('../lib/config');
const { requireAuth } = require('../middleware/auth');
const { readContent, writeDraftContent, publishDraftContent } = require('../lib/contentStore');
const { audit } = require('../lib/audit');
const logger = require('../lib/logger');

const router = express.Router();

// Multer: store uploads in /uploads with safe filenames
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = mime.includes('png') ? '.png' : mime.includes('gif') ? '.gif' : mime.includes('webp') ? '.webp' : '.jpg';
    cb(null, 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  },
});
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, !!ok);
  },
});

const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = mime.includes('webm') ? '.webm' : mime.includes('ogg') ? '.ogv' : '.mp4';
    cb(null, 'vid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  },
});
const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^video\/(mp4|webm|ogg)$/i.test(file.mimetype);
    cb(null, !!ok);
  },
});

router.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'dashboard.html'));
});

router.get('/referral.html', requireAuth, (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'referral.html'));
});

router.get('/api/admin/content', requireAuth, async (req, res) => {
  try {
    const content = await readContent();
    res.json(content);
  } catch (error) {
    logger.error('Error reading content (admin)', { error: error.message });
    res.status(500).json({ error: 'Failed to read content' });
  }
});

router.post('/api/admin/content', requireAuth, csurf(), async (req, res) => {
  try {
    const content = req.body;
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'Invalid content format' });
    }
    await writeDraftContent(content);
    logger.info('Draft content updated');
    res.json({ success: true, message: 'Content updated successfully' });
  } catch (error) {
    logger.error('Error updating content', { error: error.message });
    res.status(500).json({ error: 'Failed to update content' });
  }
});

router.get('/api/admin/csrf-token', requireAuth, csurf(), (req, res) => {
  try {
    res.json({ csrfToken: req.csrfToken() });
  } catch (e) {
    res.status(500).json({ error: 'Unable to generate CSRF token' });
  }
});

router.post('/api/admin/publish', requireAuth, csurf(), async (req, res) => {
  try {
    await publishDraftContent();
    await audit('publish_content', { user: req.session.userId || 'unknown' });
    logger.info('Content published to live');
    res.json({ success: true, message: 'Content published to live site.' });
  } catch (error) {
    logger.error('Error publishing content', { error: error.message });
    res.status(500).json({ error: 'Failed to publish content' });
  }
});

router.post('/api/admin/upload', requireAuth, csurf(), imageUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = '/uploads/' + path.basename(req.file.path);
  res.json({ success: true, url });
});

router.post('/api/admin/upload-video', requireAuth, csurf(), videoUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = '/uploads/' + path.basename(req.file.path);
  res.json({ success: true, url });
});

module.exports = router;
