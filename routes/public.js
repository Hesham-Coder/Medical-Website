const express = require('express');
const path = require('path');
const { WEBSITE_DIR, SITE_URL } = require('../lib/config');
const { readPublishedContent } = require('../lib/contentStore');
const { readPublishedPosts } = require('../lib/postStore');
const { routeContact } = require('../lib/contactRouter');
const { contactLimiter } = require('../lib/security');
const { validateContact, validatePostsQuery } = require('../lib/validation');
const { audit } = require('../lib/audit');
const { sendContactEmails } = require('../lib/mailer');
const { appendContact } = require('../lib/contentStore');
const logger = require('../lib/logger');

const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(WEBSITE_DIR, 'index.html'));
});

router.get('/posts/:slug', (req, res) => {
  res.sendFile(path.join(WEBSITE_DIR, 'post.html'));
});

router.get('/posts', (req, res) => {
  res.redirect('/#news');
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(
    'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /login.html\nDisallow: /dashboard.html\nDisallow: /referral.html\nDisallow: /api/\n\nSitemap: ' +
    SITE_URL.replace(/\/$/, '') +
    '/sitemap.xml\n'
  );
});

router.get('/sitemap.xml', (req, res) => {
  const base = SITE_URL.replace(/\/$/, '');
  readPublishedPosts().then((posts) => {
    const postUrls = posts.map((post) => {
      const safeSlug = encodeURIComponent(post.slug);
      return '  <url><loc>' + base + '/posts/' + safeSlug + '</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n';
    }).join('');
    res.type('application/xml');
    res.send(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url><loc>' + base + '/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n' +
      postUrls +
      '</urlset>\n'
    );
  }).catch(() => {
    res.type('application/xml');
    res.send(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url><loc>' + base + '/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n' +
      '</urlset>\n'
    );
  });
});

router.get('/api/public/content', async (req, res) => {
  try {
    const content = await readPublishedContent();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.json(content);
  } catch (error) {
    logger.error('Error reading content', { error: error.message });
    res.status(500).json({ error: 'Failed to read content' });
  }
});

router.get('/api/posts', async (req, res) => {
  try {
    const query = validatePostsQuery(req.query || {});
    const posts = await readPublishedPosts();
    const filtered = posts.filter((post) => {
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
    logger.error('Error reading posts', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.get('/api/posts/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) return res.status(400).json({ error: 'Slug is required' });
    const posts = await readPublishedPosts();
    const post = posts.find((item) => item.slug === slug);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (error) {
    logger.error('Error reading post by slug', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

router.post('/api/contacts', contactLimiter, async (req, res) => {
  try {
    const validation = validateContact(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }
    const data = validation.data;
    const record = {
      id: 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9),
      ...data,
      createdAt: new Date().toISOString(),
    };
    await appendContact(record);
    await audit('contact_submission', { contactId: record.id });
    sendContactEmails(record).catch((err) => logger.error('Contact emails failed', { error: err.message }));

    const content = await readPublishedContent().catch(() => null);
    const route = content && content.contactSection ? content.contactSection.formRoute : null;
    const routed = await routeContact(record, route);
    res.status(201).json({
      success: true,
      message: 'Thank you. We will contact you within 24 hours.',
      route: routed,
    });
  } catch (err) {
    logger.error('Contact submission error', { error: err.message });
    res.status(500).json({ error: 'Unable to submit. Please try again or call us.' });
  }
});

module.exports = router;
