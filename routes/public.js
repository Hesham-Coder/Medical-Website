const express = require('express');
const path = require('path');
const { WEBSITE_DIR } = require('../lib/config');
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
const SITEMAP_BASE_URL = 'https://www.waleedarafat.org';

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toDateOnly(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function buildImageXml(imageLoc, imageTitle, imageCaption) {
  return (
    '    <image:image>\n' +
    '      <image:loc>' + escapeXml(imageLoc) + '</image:loc>\n' +
    '      <image:title>' + escapeXml(imageTitle) + '</image:title>\n' +
    '      <image:caption>' + escapeXml(imageCaption) + '</image:caption>\n' +
    '    </image:image>\n'
  );
}

function buildVideoXml(videoUrl, title, description, thumbnailLoc) {
  if (!videoUrl) return '';
  return (
    '    <video:video>\n' +
    '      <video:thumbnail_loc>' + escapeXml(thumbnailLoc) + '</video:thumbnail_loc>\n' +
    '      <video:title>' + escapeXml(title) + '</video:title>\n' +
    '      <video:description>' + escapeXml(description) + '</video:description>\n' +
    '      <video:player_loc>' + escapeXml(videoUrl) + '</video:player_loc>\n' +
    '    </video:video>\n'
  );
}

function buildUrlXml(item) {
  return (
    '  <url>\n' +
    '    <loc>' + escapeXml(item.loc) + '</loc>\n' +
    '    <lastmod>' + escapeXml(item.lastmod) + '</lastmod>\n' +
    '    <changefreq>' + escapeXml(item.changefreq) + '</changefreq>\n' +
    '    <priority>' + escapeXml(item.priority) + '</priority>\n' +
    item.imageXml +
    item.videoXml +
    '  </url>\n'
  );
}

function isMobileOrTablet(req) {
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  // Keep this simple and inclusive: iPad/tablets should get the SPA.
  return (
    ua.includes('mobi') ||
    ua.includes('android') ||
    ua.includes('iphone') ||
    ua.includes('ipad') ||
    ua.includes('ipod') ||
    ua.includes('tablet') ||
    ua.includes('windows phone')
  );
}

router.get('/', (req, res) => {
  // Mobile/tablet: navigation-driven SPA
  // Desktop: legacy long-scroll experience
  // Mobile/tablet uses Tailwind mobile page.
  const file = isMobileOrTablet(req) ? 'mobile.html' : 'desktop.html';
  res.sendFile(path.join(WEBSITE_DIR, file));
});

// Desktop-only legacy experience (keeps old desktop UI).
router.get('/desktop', (req, res) => {
  res.sendFile(path.join(WEBSITE_DIR, 'desktop.html'));
});

router.get('/desktop/posts/:slug', (req, res) => {
  res.sendFile(path.join(WEBSITE_DIR, 'post-desktop.html'));
});

router.get('/posts/:slug', (req, res) => {
  // Serve the stable standalone post page on all devices.
  // The mobile SPA post bootstrap currently depends on missing modules.
  res.sendFile(path.join(WEBSITE_DIR, 'post-desktop.html'));
});

router.get('/posts', (req, res) => {
  // Legacy path -> new navigation-driven route (no anchor scrolling)
  res.redirect('/news');
});

// Navigation-driven routes (SPA). Keep server-side routing stable on refresh/deep links.
[
  '/services',
  '/team',
  '/stories',
  '/news',
  '/updates',
  '/articles',
  '/about',
  '/contact',
].forEach((p) => {
  router.get(p, (req, res) => {
    if (isMobileOrTablet(req)) {
      // Mobile page uses in-page anchors.
      const anchor = p === '/services' ? '#services' : p === '/team' ? '#doctors' : p === '/stories' ? '#news' : p === '/news' ? '#news' : p === '/articles' ? '#news' : p === '/updates' ? '#news' : p === '/about' ? '#video' : '#contact';
      return res.redirect('/' + anchor);
    }
    // Desktop legacy: keep it on /desktop
    const desktopAnchor = p === '/services' ? '#services' : p === '/team' ? '#team' : p === '/stories' ? '#testimonials' : p === '/news' ? '#news' : p === '/updates' ? '#news' : p === '/articles' ? '#articles' : p === '/about' ? '#about' : '#contact';
    return res.redirect('/desktop' + desktopAnchor);
  });
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(
    'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /login.html\nDisallow: /dashboard.html\nDisallow: /referral.html\nDisallow: /api/\n\nSitemap: ' +
    SITEMAP_BASE_URL +
    '/sitemap.xml\n'
  );
});

router.get('/sitemap.xml', async (req, res) => {
  const base = SITEMAP_BASE_URL.replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const routeTemplates = [
    { path: '/', changefreq: 'daily', priority: '1.0', imageKey: 'home' },
    { path: '/desktop', changefreq: 'monthly', priority: '0.5', imageKey: 'desktop' },
    { path: '/news', changefreq: 'weekly', priority: '0.8', imageKey: 'news' },
    { path: '/services', changefreq: 'weekly', priority: '0.7', imageKey: 'services' },
    { path: '/team', changefreq: 'monthly', priority: '0.6', imageKey: 'team' },
    { path: '/stories', changefreq: 'weekly', priority: '0.7', imageKey: 'stories' },
    { path: '/updates', changefreq: 'weekly', priority: '0.7', imageKey: 'updates' },
    { path: '/articles', changefreq: 'weekly', priority: '0.7', imageKey: 'articles' },
    { path: '/about', changefreq: 'monthly', priority: '0.5', imageKey: 'about' },
    { path: '/contact', changefreq: 'monthly', priority: '0.5', imageKey: 'contact' },
  ];

  try {
    const posts = await readPublishedPosts();
    const coreUrls = routeTemplates.map((route) => {
      const pagePath = route.path === '/' ? '' : route.path;
      return buildUrlXml({
        loc: base + pagePath,
        lastmod: today,
        changefreq: route.changefreq,
        priority: route.priority,
        imageXml: buildImageXml(
          base + '/uploads/seo-' + route.imageKey + '-image.jpg',
          route.imageKey.toUpperCase() + '_IMAGE_TITLE_PLACEHOLDER',
          route.imageKey.toUpperCase() + '_IMAGE_CAPTION_PLACEHOLDER'
        ),
        videoXml: '',
      });
    }).join('');

    const postUrls = posts
      .filter((post) => post && post.slug)
      .map((post) => {
        const safeSlug = encodeURIComponent(String(post.slug));
        const postLoc = base + '/posts/' + safeSlug;
        const imageLoc = post.featuredImage || (base + '/uploads/posts/' + safeSlug + '.jpg');
        const imageTitle = post.seoTitle || post.title || 'POST_IMAGE_TITLE_PLACEHOLDER';
        const imageCaption = post.seoDescription || post.excerpt || 'POST_IMAGE_CAPTION_PLACEHOLDER';
        const videoXml = buildVideoXml(
          post.videoUrl,
          (post.title || 'POST_VIDEO_TITLE_PLACEHOLDER') + ' Video',
          post.seoDescription || post.excerpt || 'POST_VIDEO_DESCRIPTION_PLACEHOLDER',
          post.featuredImage || (base + '/uploads/posts/' + safeSlug + '-video-thumbnail.jpg')
        );

        return buildUrlXml({
          loc: postLoc,
          lastmod: toDateOnly(post.updatedAt || post.createdAt || today),
          changefreq: 'weekly',
          priority: '0.8',
          imageXml: buildImageXml(imageLoc, imageTitle, imageCaption),
          videoXml,
        });
      })
      .join('');

    res.type('application/xml');
    res.send(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n' +
      coreUrls +
      postUrls +
      '</urlset>\n'
    );
  } catch (error) {
    logger.error('Sitemap generation failed', { error: error.message });
    res.type('application/xml');
    res.send(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n' +
      buildUrlXml({
        loc: base + '/',
        lastmod: today,
        changefreq: 'daily',
        priority: '1.0',
        imageXml: buildImageXml(
          base + '/uploads/seo-home-image.jpg',
          'HOME_IMAGE_TITLE_PLACEHOLDER',
          'HOME_IMAGE_CAPTION_PLACEHOLDER'
        ),
        videoXml: '',
      }) +
      '</urlset>\n'
    );
  }
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
