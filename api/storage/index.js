/**
 * Static file serving via API
 * Serves website, admin, and upload files
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const { WEBSITE_DIR, ADMIN_DIR, UPLOADS_DIR } = require('../../lib/config');

router.get('/:directory(*)', async (req, res) => {
  const filepath = req.query.path;
  if (!filepath) {
    return res.status(400).json({ error: 'path parameter required' });
  }

  let baseDir;
  const dir = req.params.directory || 'website';

  if (dir === 'website') baseDir = WEBSITE_DIR;
  else if (dir === 'admin') baseDir = ADMIN_DIR;
  else if (dir === 'uploads') baseDir = UPLOADS_DIR;
  else return res.status(404).json({ error: 'Invalid directory' });

  const fullPath = path.join(baseDir, filepath);
  const realPath = path.resolve(fullPath);

  // Security: prevent directory traversal
  if (!realPath.startsWith(path.resolve(baseDir))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await fs.access(realPath);
    res.sendFile(realPath);
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

module.exports = router;
