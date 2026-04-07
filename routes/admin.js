const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const csurf = require('csurf');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { ADMIN_DIR, UPLOADS_DIR, DATA_DIR, BACKUPS_DIR } = require('../lib/config');
const { requireAuth } = require('../middleware/auth');
const {
  readContent,
  writeDraftContent,
  publishDraftContent,
  queryContacts,
  deleteContact,
  deleteContacts,
  clearContacts,
  invalidateContentCaches,
  updateContactSettings,
} = require('../lib/contentStore');
const {
  readPosts,
  queryPosts,
  getDraftPostBySlug,
  getDraftPostById,
  persistPosts,
  invalidatePostsCache,
} = require('../lib/postStore');
const {
  validatePostPayload,
  validatePostsQuery,
  validateContactSettingsPayload,
  slugify,
} = require('../lib/validation');
const { createBackup, restoreBackup, listBackups } = require('../lib/backupStore');
const { audit } = require('../lib/audit');
const { invalidateUsersCache } = require('../lib/userStore');
const logger = require('../lib/logger');
const { restoreLimiter } = require('../lib/security');

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
    const ext = mime.includes('webm')
      ? '.webm'
      : mime.includes('ogg')
        ? '.ogv'
        : mime.includes('quicktime')
          ? '.mov'
          : mime.includes('x-m4v')
            ? '.m4v'
            : '.mp4';
    cb(null, 'vid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  },
});
const videoUpload = multer({
  storage: videoStorage,
  // About/dashboard videos can be larger. Keep a reasonable cap to avoid OOM on small instances.
  // Override via env if needed (value in MB).
  limits: { fileSize: (parseInt(process.env.MAX_VIDEO_UPLOAD_MB, 10) || 120) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const name = String(file.originalname || '').toLowerCase();
    const extOk = /\.(mp4|webm|ogv|ogg|mov|m4v)$/.test(name);
    const mimeOk = /^video\/(mp4|webm|ogg|quicktime|x-m4v)$/i.test(mime);
    // Some browsers (especially on mobile) may send an empty/incorrect mimetype for MP4.
    cb(null, Boolean(mimeOk || extOk));
  },
});

function safeJoin(baseDir, relPath) {
  const safeRel = relPath.replace(/^[\\/]+/, '');
  const dest = path.resolve(baseDir, safeRel);
  const base = path.resolve(baseDir);
  if (!dest.startsWith(base + path.sep) && dest !== base) {
    throw new Error('Invalid path');
  }
  return dest;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

const restoreUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, os.tmpdir());
    },
    filename: function (req, file, cb) {
      cb(null, 'restore-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.zip');
    },
  }),
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const ok = name.endsWith('.zip') || (file.mimetype || '').toLowerCase().includes('zip');
    cb(null, !!ok);
  },
});

router.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'dashboard.html'));
});

router.get('/referral.html', requireAuth, (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'referral.html'));
});

router.get('/content.html', requireAuth, (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'content.html'));
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

router.get('/api/admin/contact-settings', requireAuth, async (req, res) => {
  try {
    const content = await readContent();
    res.json((content && content.contactSettings) || {});
  } catch (error) {
    logger.error('Error reading contact settings (admin)', { error: error.message });
    res.status(500).json({ error: 'Failed to read contact settings' });
  }
});

router.get('/api/admin/contacts', requireAuth, async (req, res) => {
  try {
    const result = await queryContacts(req.query || {});
    res.json({
      items: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Error reading contacts (admin)', { error: error.message });
    res.status(500).json({ error: 'Failed to read contacts' });
  }
});

router.delete('/api/admin/contacts', requireAuth, csurf(), async (req, res) => {
  try {
    const deleteAll = String(req.query.all || '').toLowerCase() === 'true';
    if (deleteAll) {
      await clearContacts();
      await audit('delete_all_contact_submissions', { user: req.session.userId || 'unknown' });
      return res.json({ success: true, message: 'All contact submissions deleted' });
    }

    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map((id) => String(id).trim()).filter(Boolean) : [];
    if (!ids.length) {
      return res.status(400).json({ error: 'Contact IDs are required' });
    }

    await deleteContacts(ids);
    await audit('delete_selected_contact_submissions', {
      user: req.session.userId || 'unknown',
      contactIds: ids,
    });
    res.json({ success: true, message: 'Selected contact submissions deleted' });
  } catch (error) {
    logger.error('Error deleting contact submissions', { error: error.message });
    res.status(500).json({ error: 'Failed to delete contact submissions' });
  }
});

router.delete('/api/admin/contacts/:id', requireAuth, csurf(), async (req, res) => {
  try {
    const contactId = String(req.params.id || '').trim();
    if (!contactId) {
      return res.status(400).json({ error: 'Contact ID is required' });
    }
    await deleteContact(contactId);
    await audit('delete_contact_submission', { user: req.session.userId || 'unknown', contactId });
    res.json({ success: true, message: 'Contact submission deleted' });
  } catch (error) {
    if (error && error.message === 'Contact not found') {
      return res.status(404).json({ error: 'Contact submission not found' });
    }
    logger.error('Error deleting contact submission', { error: error.message });
    res.status(500).json({ error: 'Failed to delete contact submission' });
  }
});

router.post('/api/admin/content', requireAuth, csurf(), async (req, res) => {
  try {
    const content = req.body;
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'Invalid content format' });
    }
    if (content.contactSettings) {
      const validation = validateContactSettingsPayload(content.contactSettings);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error });
      }
      content.contactSettings = validation.data;
    }
    await writeDraftContent(content);
    logger.info('Draft content updated');
    res.json({ success: true, message: 'Content updated successfully' });
  } catch (error) {
    logger.error('Error updating content', { error: error.message });
    res.status(500).json({ error: 'Failed to update content' });
  }
});

router.put('/api/admin/contact-settings', requireAuth, csurf(), async (req, res) => {
  try {
    const validation = validateContactSettingsPayload(req.body || {});
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    await updateContactSettings(validation.data);
    await audit('update_contact_settings', {
      user: req.session.userId || 'unknown',
    });

    res.json({
      success: true,
      message: 'Contact settings updated successfully.',
      contactSettings: validation.data,
    });
  } catch (error) {
    logger.error('Error updating contact settings', { error: error.message });
    res.status(500).json({ error: 'Failed to update contact settings' });
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
  // Set longer timeout for video uploads (10 minutes)
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = '/uploads/' + path.basename(req.file.path);
  res.json({ success: true, url });
});

router.post('/api/admin/restore', requireAuth, restoreLimiter, csurf(), restoreUpload.single('file'), async (req, res) => {
  // Set longer timeout for restore operations (30 minutes for large backups)
  req.setTimeout(30 * 60 * 1000);
  res.setTimeout(30 * 60 * 1000);

  const zipPath = req.file && req.file.path ? String(req.file.path) : '';
  if (!zipPath) return res.status(400).json({ error: 'No backup file uploaded' });

  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    let restoredData = 0;
    let restoredUploads = 0;

    await ensureDir(DATA_DIR);
    await ensureDir(UPLOADS_DIR);

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const rawName = String(entry.entryName || '');
      const normalized = rawName.replace(/\\/g, '/').replace(/^\/+/, '');
      if (!(normalized.startsWith('data/') || normalized.startsWith('uploads/'))) continue;

      const subPath = normalized.startsWith('data/')
        ? normalized.slice('data/'.length)
        : normalized.slice('uploads/'.length);

      const targetBase = normalized.startsWith('data/') ? DATA_DIR : UPLOADS_DIR;
      const destPath = safeJoin(targetBase, subPath);

      await ensureDir(path.dirname(destPath));
      const data = entry.getData();
      await fs.writeFile(destPath, data);
      if (normalized.startsWith('data/')) restoredData += 1;
      else restoredUploads += 1;
    }

    await audit('restore_backup', {
      user: req.session.userId || 'unknown',
      restoredData,
      restoredUploads,
    });
    invalidateContentCaches();
    invalidatePostsCache();
    invalidateUsersCache();

    res.json({
      success: true,
      message: 'Restore completed',
      restored: { dataFiles: restoredData, uploadFiles: restoredUploads },
    });
  } catch (error) {
    logger.error('Restore failed', { error: error.message });
    res.status(500).json({ error: 'Restore failed' });
  } finally {
    fs.unlink(zipPath).catch(() => {});
  }
});

// Create backup endpoint
router.post('/api/admin/backup', requireAuth, csurf(), async (req, res) => {
  try {
    const result = await createBackup();
    
    if (!result.success) {
      logger.error('Backup creation failed', { message: result.message });
      return res.status(500).json({ error: result.message || 'Backup creation failed' });
    }

    await audit('create_backup', {
      user: req.session.userId || 'unknown',
      filename: result.filename,
      path: result.path,
    });

    res.json({
      success: true,
      message: result.message,
      backup: {
        filename: result.filename,
        path: result.path,
        timestamp: result.metadata?.timestamp,
        version: result.metadata?.version,
      },
    });
  } catch (error) {
    logger.error('Backup creation failed', { error: error.message });
    res.status(500).json({ error: 'Backup creation failed' });
  }
});

// List backups endpoint
router.get('/api/admin/backups', requireAuth, csurf(), async (req, res) => {
  try {
    const backups = await listBackups();
    
    res.json({
      success: true,
      count: backups.length,
      backups: backups.map(b => ({
        filename: b.filename || b.name,
        timestamp: b.timestamp,
        size: b.size,
        sizeReadable: b.sizeReadable,
      })),
    });
  } catch (error) {
    logger.error('Failed to list backups', { error: error.message });
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// Download backup endpoint
router.get('/api/admin/backup/download/:filename', requireAuth, async (req, res) => {
  try {
    const filename = String(req.params.filename || '');
    
    // Sanitize filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }

    const backupPath = safeJoin(BACKUPS_DIR, filename);
    
    try {
      await fs.access(backupPath);
    } catch {
      return res.status(404).json({ error: 'Backup not found' });
    }

    await audit('download_backup', {
      user: req.session.userId || 'unknown',
      filename,
    });

    res.download(backupPath, filename);
  } catch (error) {
    logger.error('Backup download failed', { error: error.message });
    res.status(500).json({ error: 'Backup download failed' });
  }
});

function ensureUniqueSlug(posts, slug, currentId) {
  let candidate = slug;
  let counter = 2;
  while (posts.some((post) => post.slug === candidate && post.id !== currentId)) {
    candidate = `${slug}-${counter}`;
    counter += 1;
  }
  return candidate;
}

router.get('/api/admin/posts', requireAuth, async (req, res) => {
  try {
    const query = validatePostsQuery(req.query || {});
    const result = await queryPosts(query);
    res.json({
      items: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Error reading admin posts', { error: error.message });
    res.status(500).json({ error: 'Failed to read posts' });
  }
});

router.get('/api/admin/posts/:slug', requireAuth, async (req, res) => {
  try {
    const slug = slugify(req.params.slug || '');
    if (!slug) return res.status(400).json({ error: 'Slug is required' });
    const post = await getDraftPostBySlug(slug);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (error) {
    logger.error('Error reading admin post by slug', { error: error.message });
    res.status(500).json({ error: 'Failed to read post' });
  }
});

router.get('/api/admin/posts/id/:id', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid post id' });
    const post = await getDraftPostById(id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (error) {
    logger.error('Error reading admin post by id', { error: error.message });
    res.status(500).json({ error: 'Failed to read post' });
  }
});

router.post('/api/admin/posts', requireAuth, csurf(), async (req, res) => {
  try {
    const validation = validatePostPayload(req.body || null);
    if (!validation.success) return res.status(400).json({ error: validation.error });
    const posts = await readPosts();
    const now = new Date().toISOString();
    const payload = validation.data;
    payload.id = 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    payload.slug = ensureUniqueSlug(posts, payload.slug, payload.id);
    payload.createdAt = now;
    payload.updatedAt = now;
    posts.push(payload);
    await persistPosts(posts);
    await audit('post_create', { postId: payload.id, user: req.session.userId || 'unknown' });
    res.status(201).json(payload);
  } catch (error) {
    logger.error('Error creating post', { error: error.message });
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.put('/api/admin/posts/:id', requireAuth, csurf(), async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid post id' });
    const posts = await readPosts();
    const index = posts.findIndex((post) => post.id === id);
    if (index < 0) return res.status(404).json({ error: 'Post not found' });
    const existing = posts[index];
    const validation = validatePostPayload(req.body || null, existing);
    if (!validation.success) return res.status(400).json({ error: validation.error });
    const payload = validation.data;
    payload.id = existing.id;
    payload.createdAt = existing.createdAt;
    payload.updatedAt = new Date().toISOString();
    payload.slug = ensureUniqueSlug(posts, payload.slug, payload.id);
    posts[index] = payload;
    await persistPosts(posts);
    await audit('post_update', { postId: payload.id, user: req.session.userId || 'unknown' });
    res.json(payload);
  } catch (error) {
    logger.error('Error updating post', { error: error.message });
    res.status(500).json({ error: 'Failed to update post' });
  }
});

router.delete('/api/admin/posts/:id', requireAuth, csurf(), async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid post id' });
    const posts = await readPosts();
    const next = posts.filter((post) => post.id !== id);
    if (next.length === posts.length) return res.status(404).json({ error: 'Post not found' });
    await persistPosts(next);
    await audit('post_delete', { postId: id, user: req.session.userId || 'unknown' });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting post', { error: error.message });
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

router.patch('/api/admin/posts/:id/publish', requireAuth, csurf(), async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid post id' });
    const posts = await readPosts();
    const index = posts.findIndex((post) => post.id === id);
    if (index < 0) return res.status(404).json({ error: 'Post not found' });
    posts[index].isPublished = !posts[index].isPublished;
    posts[index].updatedAt = new Date().toISOString();
    await persistPosts(posts);
    await audit('post_toggle_publish', { postId: id, user: req.session.userId || 'unknown' });
    res.json(posts[index]);
  } catch (error) {
    logger.error('Error toggling publish', { error: error.message });
    res.status(500).json({ error: 'Failed to toggle publish state' });
  }
});

router.patch('/api/admin/posts/:id/feature', requireAuth, csurf(), async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid post id' });
    const posts = await readPosts();
    const index = posts.findIndex((post) => post.id === id);
    if (index < 0) return res.status(404).json({ error: 'Post not found' });
    posts[index].isFeatured = !posts[index].isFeatured;
    posts[index].updatedAt = new Date().toISOString();
    await persistPosts(posts);
    await audit('post_toggle_feature', { postId: id, user: req.session.userId || 'unknown' });
    res.json(posts[index]);
  } catch (error) {
    logger.error('Error toggling feature', { error: error.message });
    res.status(500).json({ error: 'Failed to toggle feature state' });
  }
});

module.exports = router;
