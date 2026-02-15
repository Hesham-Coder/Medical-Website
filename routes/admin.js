const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const csurf = require('csurf');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { ADMIN_DIR, UPLOADS_DIR, DATA_DIR } = require('../lib/config');
const { requireAuth } = require('../middleware/auth');
const { readContent, readContacts, writeDraftContent, publishDraftContent } = require('../lib/contentStore');
const { readPosts, writePosts, syncPublishedPosts } = require('../lib/postStore');
const { validatePostPayload, validatePostsQuery, slugify } = require('../lib/validation');
const { audit } = require('../lib/audit');
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
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^video\/(mp4|webm|ogg|quicktime|x-m4v)$/i.test(file.mimetype);
    cb(null, !!ok);
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

router.get('/api/admin/contacts', requireAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 5), 100);
    const search = (req.query.search ? String(req.query.search) : '').trim().toLowerCase().slice(0, 120);

    const raw = await readContacts();
    const list = Array.isArray(raw) ? raw : [];
    const sorted = list.slice().sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const filtered = !search ? sorted : sorted.filter((c) => {
      const hay = [
        c && c.firstName,
        c && c.lastName,
        c && c.email,
        c && c.phone,
        c && c.concern,
        c && c.message,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(search);
    });

    const total = filtered.length;
    const pages = Math.max(Math.ceil(total / limit), 1);
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * limit;
    const items = filtered.slice(start, start + limit);

    res.json({
      items,
      pagination: {
        page: safePage,
        limit,
        total,
        pages,
        hasNext: safePage < pages,
      },
    });
  } catch (error) {
    logger.error('Error reading contacts (admin)', { error: error.message });
    res.status(500).json({ error: 'Failed to read contacts' });
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

router.post('/api/admin/restore', requireAuth, restoreLimiter, csurf(), restoreUpload.single('file'), async (req, res) => {
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

function ensureUniqueSlug(posts, slug, currentId) {
  let candidate = slug;
  let counter = 2;
  while (posts.some((post) => post.slug === candidate && post.id !== currentId)) {
    candidate = `${slug}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function sortPostsByDate(posts) {
  return posts.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

router.get('/api/admin/posts', requireAuth, async (req, res) => {
  try {
    const query = validatePostsQuery(req.query || {});
    const raw = sortPostsByDate(await readPosts());
    const filtered = raw.filter((post) => {
      if (query.type && post.type !== query.type) return false;
      if (query.search) {
        const haystack = [post.title, post.excerpt, post.author, (post.tags || []).join(' ')].join(' ').toLowerCase();
        if (!haystack.includes(query.search.toLowerCase())) return false;
      }
      return true;
    });
    const total = filtered.length;
    const pages = Math.max(Math.ceil(total / query.limit), 1);
    const safePage = Math.min(query.page, pages);
    const start = (safePage - 1) * query.limit;
    const items = filtered.slice(start, start + query.limit);
    res.json({
      items,
      pagination: {
        page: safePage,
        limit: query.limit,
        total,
        pages,
        hasNext: safePage < pages,
      },
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
    const posts = await readPosts();
    const post = posts.find((item) => item.slug === slug);
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
    const posts = await readPosts();
    const post = posts.find((item) => item.id === id);
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
    const sorted = sortPostsByDate(posts);
    await writePosts(sorted);
    await syncPublishedPosts(sorted);
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
    const sorted = sortPostsByDate(posts);
    await writePosts(sorted);
    await syncPublishedPosts(sorted);
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
    const sorted = sortPostsByDate(next);
    await writePosts(sorted);
    await syncPublishedPosts(sorted);
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
    const sorted = sortPostsByDate(posts);
    await writePosts(sorted);
    await syncPublishedPosts(sorted);
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
    const sorted = sortPostsByDate(posts);
    await writePosts(sorted);
    await syncPublishedPosts(sorted);
    await audit('post_toggle_feature', { postId: id, user: req.session.userId || 'unknown' });
    res.json(posts[index]);
  } catch (error) {
    logger.error('Error toggling feature', { error: error.message });
    res.status(500).json({ error: 'Failed to toggle feature state' });
  }
});

module.exports = router;
