const express = require('express');
const path = require('path');
const { promises: fs } = require('fs');
const { WEBSITE_DIR, SITE_URL } = require('../lib/config');
const { readPublishedContent, getPublishedContentSnapshot } = require('../lib/contentStore');
const { queryPublishedPosts, getPublishedPostBySlug, getPublishedPostsSnapshot } = require('../lib/postStore');
const { routeContact } = require('../lib/contactRouter');
const { contactLimiter } = require('../lib/security');
const { validateContact, validatePostsQuery } = require('../lib/validation');
const { audit } = require('../lib/audit');
const { sendContactEmails } = require('../lib/mailer');
const { appendContact } = require('../lib/contentStore');
const { requestIsFresh, setResponseCacheHeaders } = require('../lib/httpCache');
const { injectSeoContent, injectPostSeoContent } = require('../lib/seoInjector');
const logger = require('../lib/logger');
const { getUiScale } = require('../lib/settingsStore');


const router = express.Router();
const SITEMAP_BASE_URL = SITE_URL || 'https://www.waleedarafat.org';
let sitemapCache = {
  key: '',
  xml: '',
};

function buildDerivedEtag(parts) {
  const safeKey = parts
    .map((part) => encodeURIComponent(String(part == null ? '' : part)))
    .join(':');
  return `W/"${Buffer.byteLength(safeKey, 'utf8')}-${safeKey}"`;
}

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

/**
 * Detect language from cookie (server-readable), query param, or Accept-Language header.
 * Priority order (highest → lowest):
 *   1. ?lang= query param  (explicit one-time override)
 *   2. 'lang' cookie       (persisted user preference, set by client on language switch)
 *   3. Accept-Language header (browser hint)
 *   4. 'ar' default        (this is an Arabic-first website)
 * Returns 'ar' or 'en'.
 */
function detectLanguage(req) {
  // 1. Explicit query override (?lang=en / ?lang=ar)
  if (req.query && req.query.lang) {
    return req.query.lang === 'en' ? 'en' : 'ar';
  }

  // 2. Cookie — set by client after a manual language switch (persists across requests)
  const cookieLang = req.cookies && req.cookies['lang'];
  if (cookieLang === 'en' || cookieLang === 'ar') {
    return cookieLang;
  }

  // 3. Accept-Language header hint
  const acceptLang = req.headers['accept-language'] || '';
  // If browser explicitly lists English and NOT Arabic, serve English
  if (acceptLang && !acceptLang.toLowerCase().includes('ar')) {
    if (acceptLang.toLowerCase().includes('en')) return 'en';
  }
  if (acceptLang.toLowerCase().includes('ar')) return 'ar';

  // 4. Default: Arabic (this is an Arabic-first medical website)
  return 'ar';
}

/**
 * Read HTML file, inject the server-determined lang/dir into the <html> tag,
 * and inject SEO tags — all before the response is sent to the browser.
 * pageContext: { type: 'home'|'team'|'services'|..., post, posts }
 */
async function serveSeoHtmlFile(res, filePath, contentData, lang = 'ar', pageContext = null) {
  try {
    let htmlContent = await fs.readFile(filePath, 'utf-8');

    // ── 1. Inject lang/dir into the <html> opening tag ──
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const htmlLang = lang === 'ar' ? 'ar' : 'en';
    htmlContent = htmlContent.replace(
      /(\<html\b[^>]*)\s+lang="[^"]*"/i,
      `$1 lang="${htmlLang}"`
    );
    htmlContent = htmlContent.replace(
      /(\<html\b[^>]*)\s+dir="[^"]*"/i,
      `$1 dir="${dir}"`
    );
    if (!htmlContent.match(/lang="(ar|en)"/i)) {
      htmlContent = htmlContent.replace(/(\<html\b)/i, `$1 lang="${htmlLang}"`);
    }
    if (!htmlContent.match(/dir="(rtl|ltr)"/i)) {
      htmlContent = htmlContent.replace(/(\<html\b)/i, `$1 dir="${dir}"`);
    }
    htmlContent = htmlContent.replace(
      /(\<html\b[^>]*)\s+class="([^"]*)"/i,
      (match, prefix, cls) => {
        const cleaned = cls.replace(/\blang-(ar|en)\b/g, '').trim();
        return `${prefix} class="${cleaned ? cleaned + ' ' : ''}lang-${lang}"`;
      }
    );

    // ── 2. Inject dynamic SEO tags + per-page structured data ──
    htmlContent = injectSeoContent(htmlContent, contentData, lang, pageContext);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(htmlContent);
  } catch (error) {
    logger.error('Error serving SEO HTML', { error: error.message, filePath });
    res.sendFile(filePath);
  }
}

// ── Language persistence endpoint ──────────────────────────────────────────
// Called by client JS after the user switches language.
// Writes a server-readable cookie so the next page load gets the right dir/lang baked in.
router.post('/api/lang', (req, res) => {
  const body = req.body || {};
  const lang = body.lang === 'en' ? 'en' : 'ar';
  res.cookie('lang', lang, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year (ms)
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  res.json({ ok: true, lang });
});

router.get('/', async (req, res) => {
  try {
    const lang = detectLanguage(req);
    const contentData = await readPublishedContent();
    const file = isMobileOrTablet(req) ? 'mobile.html' : 'desktop.html';
    const filePath = path.join(WEBSITE_DIR, file);
    await serveSeoHtmlFile(res, filePath, contentData, lang, { type: 'home' });
  } catch (error) {
    logger.error('Error in root route', { error: error.message });
    const file = isMobileOrTablet(req) ? 'mobile.html' : 'desktop.html';
    res.sendFile(path.join(WEBSITE_DIR, file));
  }
});

// Desktop-only legacy experience.
router.get('/desktop', async (req, res) => {
  try {
    const lang = detectLanguage(req);
    const contentData = await readPublishedContent();
    const filePath = path.join(WEBSITE_DIR, 'desktop.html');
    await serveSeoHtmlFile(res, filePath, contentData, lang, { type: 'home' });
  } catch (error) {
    logger.error('Error in /desktop route', { error: error.message });
    res.sendFile(path.join(WEBSITE_DIR, 'desktop.html'));
  }
});

router.get('/desktop/posts/:slug', async (req, res) => {
  try {
    const lang = detectLanguage(req);
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const contentData = await readPublishedContent();
    const post = slug ? await getPublishedPostBySlug(slug) : null;
    const filePath = path.join(WEBSITE_DIR, 'post-desktop.html');
    let html = await fs.readFile(filePath, 'utf-8');
    html = injectPostSeoContent(html, post, contentData, lang);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  } catch (error) {
    logger.error('Error in /desktop/posts/:slug', { error: error.message });
    res.sendFile(path.join(WEBSITE_DIR, 'post-desktop.html'));
  }
});

router.get('/posts/:slug', async (req, res) => {
  try {
    const lang = detectLanguage(req);
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const contentData = await readPublishedContent();
    const post = slug ? await getPublishedPostBySlug(slug) : null;
    const filePath = path.join(WEBSITE_DIR, 'post-desktop.html');
    let html = await fs.readFile(filePath, 'utf-8');
    html = injectPostSeoContent(html, post, contentData, lang);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  } catch (error) {
    logger.error('Error in /posts/:slug', { error: error.message });
    res.sendFile(path.join(WEBSITE_DIR, 'post-desktop.html'));
  }
});

router.get('/posts', (req, res) => {
  // Legacy path -> new navigation-driven route (no anchor scrolling)
  res.redirect('/news');
});

// Navigation-driven routes (SPA). Pass correct page context per route.
const PAGE_TYPE_MAP = {
  '/services': 'services',
  '/team': 'team',
  '/stories': 'home',
  '/news': 'news',
  '/updates': 'updates',
  '/articles': 'articles',
  '/about': 'about',
  '/contact': 'contact',
};
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
  router.get(p, async (req, res) => {
    if (isMobileOrTablet(req)) {
      const anchor = p === '/services' ? '#services' : p === '/team' ? '#doctors' : p === '/stories' ? '#news' : p === '/news' ? '#news' : p === '/articles' ? '#news' : p === '/updates' ? '#news' : p === '/about' ? '#video' : '#contact';
      return res.redirect('/' + anchor);
    }
    try {
      const lang = detectLanguage(req);
      const contentData = await readPublishedContent();
      const filePath = path.join(WEBSITE_DIR, 'desktop.html');
      const pageType = PAGE_TYPE_MAP[p] || 'home';
      await serveSeoHtmlFile(res, filePath, contentData, lang, { type: pageType });
    } catch (error) {
      logger.error('Error serving SPA route ' + p, { error: error.message });
      const desktopAnchor = p === '/services' ? '#services' : p === '/team' ? '#team' : p === '/stories' ? '#testimonials' : p === '/news' ? '#news' : p === '/updates' ? '#news' : p === '/articles' ? '#articles' : p === '/about' ? '#about' : '#contact';
      return res.redirect('/desktop' + desktopAnchor);
    }
  });
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(
    'User-agent: *\n' +
    'Allow: /\n' +
    'Disallow: /admin/\n' +
    'Disallow: /admin\n' +
    'Disallow: /login.html\n' +
    'Disallow: /dashboard.html\n' +
    'Disallow: /referral.html\n' +
    'Disallow: /api/\n' +
    'Crawl-delay: 5\n\n' +
    '# Faster crawl for major search engines\n' +
    'User-agent: Googlebot\n' +
    'Crawl-delay: 0\n\n' +
    'User-agent: Bingbot\n' +
    'Crawl-delay: 1\n\n' +
    'Sitemap: ' + SITEMAP_BASE_URL + '/sitemap.xml\n'
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
    const postsSnapshot = await getPublishedPostsSnapshot();
    const sitemapKey = `${today}:${postsSnapshot.metadata.etag}`;
    if (sitemapCache.key !== sitemapKey) {
      const posts = postsSnapshot.data;
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

      sitemapCache = {
        key: sitemapKey,
        xml:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n' +
          coreUrls +
          postUrls +
          '</urlset>\n',
      };
    }

    const metadata = {
      etag: buildDerivedEtag(['sitemap', today, postsSnapshot.metadata.mtimeMs || 0, postsSnapshot.metadata.size || 0]),
      lastModified: postsSnapshot.metadata.lastModified,
    };
    setResponseCacheHeaders(res, {
      ...metadata,
      maxAgeSeconds: 300,
      staleWhileRevalidateSeconds: 1800,
    });
    if (requestIsFresh(req, metadata)) {
      return res.status(304).end();
    }
    res.type('application/xml');
    res.send(sitemapCache.xml);
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
    const snapshot = await getPublishedContentSnapshot();
    setResponseCacheHeaders(res, {
      ...snapshot.metadata,
      maxAgeSeconds: 60,
      staleWhileRevalidateSeconds: 300,
    });
    if (requestIsFresh(req, snapshot.metadata)) {
      return res.status(304).end();
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.json(snapshot.data);
  } catch (error) {
    logger.error('Error reading content', { error: error.message });
    res.status(500).json({ error: 'Failed to read content' });
  }
});

router.get('/api/posts', async (req, res) => {
  try {
    const query = validatePostsQuery(req.query || {});
    const includeFeatured = String(req.query && req.query.includeFeatured || '').trim() === '1';
    const result = await queryPublishedPosts(query, { includeFeatured });
    const metadata = {
      etag: buildDerivedEtag([
        'posts',
        result.metadata.mtimeMs || 0,
        result.metadata.size || 0,
        query.type || 'all',
        query.search || '',
        query.page,
        query.limit,
        includeFeatured ? 'featured' : 'plain',
      ]),
      lastModified: result.metadata.lastModified,
    };
    setResponseCacheHeaders(res, {
      ...metadata,
      maxAgeSeconds: 30,
      staleWhileRevalidateSeconds: 120,
    });
    if (requestIsFresh(req, metadata)) {
      return res.status(304).end();
    }
    res.json(includeFeatured ? result : { items: result.items, pagination: result.pagination });
  } catch (error) {
    logger.error('Error reading posts', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.get('/api/posts/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) return res.status(400).json({ error: 'Slug is required' });
    const post = await getPublishedPostBySlug(slug);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const postsSnapshot = await getPublishedPostsSnapshot();
    const metadata = {
      etag: buildDerivedEtag(['post', slug, postsSnapshot.metadata.mtimeMs || 0, postsSnapshot.metadata.size || 0]),
      lastModified: postsSnapshot.metadata.lastModified,
    };
    setResponseCacheHeaders(res, {
      ...metadata,
      maxAgeSeconds: 60,
      staleWhileRevalidateSeconds: 300,
    });
    if (requestIsFresh(req, metadata)) {
      return res.status(304).end();
    }
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

    // Honeypot triggered — silently discard; return a convincing success response
    if (validation._honeypot) {
      return res.status(201).json({
        success: true,
        message: 'Thank you. We will contact you within 24 hours.',
      });
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

// Public endpoint: returns the current ui_scale. No auth required (website needs it on load).
// Returns a short-lived cached value to avoid hammering the filesystem.
router.get('/api/settings/ui-scale', async (req, res) => {
  try {
    const scale = await getUiScale();
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json({ ui_scale: scale });
  } catch (error) {
    logger.error('Error reading public ui_scale', { error: error.message });
    res.json({ ui_scale: 1.0 }); // safe fallback — never break users
  }
});

module.exports = router;
