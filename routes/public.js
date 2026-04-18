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
const { injectSeoContent, resolveOgImageUrl, getCanonicalSiteUrl } = require('../lib/seoInjector');
const logger = require('../lib/logger');
const http = require('http');
const https = require('https');
const { URL } = require('url');

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

/**
 * Like escapeXml but also strips newlines, tabs and carriage returns.
 * Use for ANY field pulled from CMS data that goes into sitemap XML —
 * newlines inside <loc> or <title> break the XML parser.
 */
function escapeXmlSanitized(value) {
  return escapeXml(
    String(value || '').replace(/[\r\n\t\u0000-\u001F\u007F]+/g, ' ').trim()
  );
}

/**
 * Returns true if the given URL is a valid self-hosted image
 * (i.e. not a Facebook CDN, reel, or other external unstable URL).
 * Sitemap image:loc must point to a crawlable, stable, public image.
 */
function isSelfHostedImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (/\/\/(www\.)?facebook\.com|fbcdn\.net|scontent\.|fb\.com/.test(url)) return false;
  if (!/\.(jpe?g|png|gif|webp|avif|svg)$/i.test(url)) return false;
  return true;
}

/**
 * Returns an absolute URL: if path starts with http it is returned as-is,
 * otherwise it is prefixed with SITEMAP_BASE_URL.
 */
function toAbsoluteUrl(path) {
  if (!path || typeof path !== 'string') return '';
  return path.startsWith('http') ? path : `${SITEMAP_BASE_URL.replace(/\/$/, '')}${path}`;
}

function toDateOnly(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Build image sitemap XML. Returns empty string if imageLoc is not a
 * stable, self-hosted image URL (blocks Facebook CDN, reels, etc.).
 */
function buildImageXml(imageLoc, imageTitle, imageCaption) {
  const absLoc = toAbsoluteUrl(imageLoc);
  if (!isSelfHostedImageUrl(absLoc)) return '';
  return (
    '    <image:image>\n' +
    '      <image:loc>' + escapeXmlSanitized(absLoc) + '</image:loc>\n' +
    '      <image:title>' + escapeXmlSanitized(imageTitle) + '</image:title>\n' +
    '      <image:caption>' + escapeXmlSanitized(imageCaption) + '</image:caption>\n' +
    '    </image:image>\n'
  );
}

/**
 * Build video sitemap XML.
 * Uses <video:content_loc> (correct for direct MP4 files) and absolute URLs.
 */
function buildVideoXml(videoUrl, title, description, thumbnailLoc) {
  if (!videoUrl) return '';
  const absVideoUrl = toAbsoluteUrl(videoUrl);
  const absThumbnail = toAbsoluteUrl(thumbnailLoc);
  // Only include thumbnail if it is a stable, self-hosted image
  const thumbXml = isSelfHostedImageUrl(absThumbnail)
    ? '      <video:thumbnail_loc>' + escapeXmlSanitized(absThumbnail) + '</video:thumbnail_loc>\n'
    : '';
  return (
    '    <video:video>\n' +
    thumbXml +
    '      <video:title>' + escapeXmlSanitized(title) + '</video:title>\n' +
    '      <video:description>' + escapeXmlSanitized(description) + '</video:description>\n' +
    '      <video:content_loc>' + escapeXmlSanitized(absVideoUrl) + '</video:content_loc>\n' +
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
 * Detect language from query param or Accept-Language header
 * Returns 'ar' or 'en'
 */
function detectLanguage(req) {
  // Check explicit query param (?lang=ar or ?lang=en)
  if (req.query && req.query.lang) {
    return req.query.lang === 'ar' ? 'ar' : 'en';
  }

  // Check Accept-Language header — only switch to Arabic if Arabic is
  // explicitly preferred AND has higher quality than English.
  // Googlebot sends no Accept-Language header, so it correctly falls
  // through to the default English, ensuring Googlebot indexes English content.
  const acceptLang = req.headers['accept-language'] || '';
  if (acceptLang) {
    // Parse quality values for ar and en
    const arMatch = acceptLang.match(/\bar(?:-\w+)?(?:;q=([\d.]+))?/i);
    const enMatch = acceptLang.match(/\ben(?:-\w+)?(?:;q=([\d.]+))?/i);
    const arQ = arMatch ? parseFloat(arMatch[1] != null ? arMatch[1] : '1') : 0;
    const enQ = enMatch ? parseFloat(enMatch[1] != null ? enMatch[1] : '1') : 0;
    if (arQ > 0 && arQ > enQ) return 'ar';
  }

  // Default to English (Googlebot, undefined user-agent, no header)
  return 'en';
}

/**
 * Read HTML file and inject SEO tags
 * Usage: await serveSeoHtmlFile(res, filePath, contentData, lang)
 */
async function serveSeoHtmlFile(res, filePath, contentData, lang = 'en') {
  try {
    let htmlContent = await fs.readFile(filePath, 'utf-8');
    
    // Inject dynamic SEO tags
    htmlContent = injectSeoContent(htmlContent, contentData, lang);
    
    // HTML should revalidate so updated versioned asset URLs are picked up immediately.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(htmlContent);
  } catch (error) {
    logger.error('Error serving SEO HTML', { error: error.message, filePath });
    // Fallback to sendFile if injection fails
    res.sendFile(filePath);
  }
}

router.get('/', async (req, res) => {
  try {
    // Detect language for SEO tags
    const lang = detectLanguage(req);
    
    // Read published content (has SEO-critical data: hero heading, description, etc.)
    const contentData = await readPublishedContent();
    
    // Mobile/tablet: navigation-driven SPA
    // Desktop: legacy long-scroll experience
    // Mobile/tablet uses Tailwind mobile page.
    const file = isMobileOrTablet(req) ? 'mobile.html' : 'desktop.html';
    const filePath = path.join(WEBSITE_DIR, file);
    
    // Serve HTML with injected SEO tags
    await serveSeoHtmlFile(res, filePath, contentData, lang);
  } catch (error) {
    logger.error('Error in root route', { error: error.message });
    // Fallback to basic sendFile
    const file = isMobileOrTablet(req) ? 'mobile.html' : 'desktop.html';
    res.sendFile(path.join(WEBSITE_DIR, file));
  }
});

// Desktop-only legacy experience.
// Marked noindex to prevent duplicate-content competition with /
// (both routes serve desktop.html with identical content).
router.get('/desktop', async (req, res) => {
  // Tell search engines to ignore this URL — the canonical is /
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    const lang = detectLanguage(req);
    const contentData = await readPublishedContent();
    const filePath = path.join(WEBSITE_DIR, 'desktop.html');
    await serveSeoHtmlFile(res, filePath, contentData, lang);
  } catch (error) {
    logger.error('Error in /desktop route', { error: error.message });
    res.sendFile(path.join(WEBSITE_DIR, 'desktop.html'));
  }
});

// SEO metadata for each core sitemap route
const SITEMAP_IMAGE_META = {
  home:     { title: 'Comprehensive Cancer Center — Expert Oncology Care in Alexandria', caption: 'Multidisciplinary cancer care: chemotherapy, radiation, surgical oncology & genetic counseling in Alexandria, Egypt' },
  desktop:  { title: 'CCC Full Experience — Comprehensive Cancer Center', caption: 'Interactive cancer center portal with services, team, and appointment booking' },
  news:     { title: 'Cancer Center News — Comprehensive Cancer Center', caption: 'Latest oncology news, medical updates, and announcements from CCC Alexandria' },
  services: { title: 'Oncology Services — Chemotherapy, Radiation & Surgical Oncology', caption: 'Full-spectrum cancer care services including systemic therapies, radiation, surgery and supportive care' },
  team:     { title: 'Expert Cancer Specialists — Comprehensive Cancer Center', caption: 'Board-certified oncologists, surgeons and radiation specialists in Alexandria, Egypt' },
  stories:  { title: 'Patient Stories & Testimonials — CCC Alexandria', caption: 'Real recovery journeys and patient experiences at Comprehensive Cancer Center' },
  updates:  { title: 'Medical Updates — Comprehensive Cancer Center', caption: 'Latest clinical updates, new treatments and announcements from our cancer center' },
  articles: { title: 'Cancer Care Articles & Research Insights — CCC', caption: 'Evidence-based oncology articles, research highlights, and patient education content' },
  about:    { title: 'About Comprehensive Cancer Center — Alexandria, Egypt', caption: 'Our mission, multidisciplinary team, and commitment to guideline-based cancer care' },
  contact:  { title: 'Contact CCC — Book a Cancer Care Consultation', caption: 'Get in touch with our patient coordination team to schedule a consultation' },
};

/**
 * Build a post-specific content object for SEO injection on /posts/:slug pages.
 */
function buildPostSeoContent(post) {
  if (!post) return {};
  const title = post.seoTitle || post.title || 'Article';
  const description = (post.seoDescription || post.excerpt || '').substring(0, 160);
  const image = post.featuredImage || '/uploads/seo-og-image.jpg';
  return {
    siteInfo: {
      title: 'Comprehensive Cancer Center',
      heroHeading: { en: title, ar: title },
      heroDescription: { en: description, ar: description },
    },
    seo: {
      metaTitle: { en: `${title} | Comprehensive Cancer Center` },
      metaDescription: { en: description },
      ogImage: image,
      twitterHandle: '@cccofegypt',
    },
  };
}

router.get('/desktop/posts/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const lang = detectLanguage(req);
    const post = await getPublishedPostBySlug(slug).catch(() => null);
    const postContent = buildPostSeoContent(post);
    const filePath = path.join(WEBSITE_DIR, 'post-desktop.html');
    await serveSeoHtmlFile(res, filePath, postContent, lang);
  } catch (error) {
    logger.error('Error in /desktop/posts/:slug', { error: error.message });
    res.sendFile(path.join(WEBSITE_DIR, 'post-desktop.html'));
  }
});

router.get('/posts/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const lang = detectLanguage(req);
    const post = await getPublishedPostBySlug(slug).catch(() => null);
    const postContent = buildPostSeoContent(post);
    const filePath = path.join(WEBSITE_DIR, 'post-desktop.html');
    await serveSeoHtmlFile(res, filePath, postContent, lang);
  } catch (error) {
    logger.error('Error in /posts/:slug', { error: error.message });
    res.sendFile(path.join(WEBSITE_DIR, 'post-desktop.html'));
  }
});


router.get('/posts', (req, res) => {
  // Legacy path -> new navigation-driven route (no anchor scrolling)
  res.redirect('/news');
});

// Navigation-driven section routes.
// These are SPA deep-links / anchor redirects — they do NOT have unique
// indexable content. Mark all as noindex to prevent cannibalisation of /.
// Long-term: replace with dedicated SSR pages with unique metadata.
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
    // Prevent indexing — these routes only redirect to anchor links
    res.setHeader('X-Robots-Tag', 'noindex');
    if (isMobileOrTablet(req)) {
      const anchor = p === '/services' ? '#services' : p === '/team' ? '#doctors' : p === '/stories' ? '#news' : p === '/news' ? '#news' : p === '/articles' ? '#news' : p === '/updates' ? '#news' : p === '/about' ? '#video' : '#contact';
      return res.redirect('/' + anchor);
    }
    const desktopAnchor = p === '/services' ? '#services' : p === '/team' ? '#team' : p === '/stories' ? '#testimonials' : p === '/news' ? '#news' : p === '/updates' ? '#news' : p === '/articles' ? '#articles' : p === '/about' ? '#about' : '#contact';
    return res.redirect('/desktop' + desktopAnchor);
  });
});

/**
 * /default-og.jpg — stable, bookmarkable alias for the OG fallback image.
 * Social crawlers and Phase 5 fallback always resolve here if the dashboard
 * image is missing, invalid, or from a wrong domain.
 * Redirects to the real file so uploads/ Cache-Control headers apply.
 */
router.get('/default-og.jpg', (req, res) => {
  res.redirect(301, '/uploads/og-premium.jpg');
});

/**
 * Helper to perform a HEAD request to verify an image URL.
 */
function checkImageUrl(imageUrl) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(imageUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(imageUrl, { method: 'HEAD', timeout: 5000 }, (res) => {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
        });
      });
      req.on('error', () => resolve({ statusCode: 0, contentType: 'connection-error' }));
      req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, contentType: 'timeout' }); });
      req.end();
    } catch (e) {
      resolve({ statusCode: 0, contentType: 'invalid-url' });
    }
  });
}

/**
 * /og-health — Phase 8 debug endpoint (unauthenticated, read-only).
 * Returns a JSON report of the current OG image pipeline state.
 */
router.get('/og-health', async (req, res) => {
  try {
    const contentData = await readPublishedContent();
    const seoData = (contentData && contentData.seo) || {};
    const canonicalSiteUrl = getCanonicalSiteUrl();
    const rawOgImage = seoData.socialShareImage || seoData.ogImage
      || (contentData.siteInfo && contentData.siteInfo.heroImageUrl)
      || '';
    
    const report = resolveOgImageUrl(rawOgImage, canonicalSiteUrl);
    
    // Live validation (Phase 3)
    const liveCheck = await checkImageUrl(report.finalOgImageUrl);
    
    const isValid = !report.fallbackUsed && 
                    liveCheck.statusCode === 200 && 
                    (liveCheck.contentType || '').startsWith('image/');

    res.json({
      dashboard_value: report.dashboardValue,
      final_url: report.finalOgImageUrl,
      status_code: liveCheck.statusCode,
      content_type: liveCheck.contentType,
      is_valid: isValid,
      source_of_truth: 'dashboard (content.published.json)',
      fallback_used: report.fallbackUsed || (liveCheck.statusCode !== 200),
      issues_found: report.issuesFound.concat(
        liveCheck.statusCode !== 200 ? [`HTTP check failed with status ${liveCheck.statusCode}`] : []
      ),
      canonical_site_url: canonicalSiteUrl,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /login.html',
    'Disallow: /dashboard.html',
    'Disallow: /referral.html',
    'Disallow: /api/',
    'Disallow: /health',
    '',
    '# Faster crawl for Googlebot (no delay)',
    'User-agent: Googlebot',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /login.html',
    'Disallow: /api/',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /login.html',
    'Disallow: /api/',
    '',
    'Sitemap: ' + SITEMAP_BASE_URL + '/sitemap.xml',
  ];
  res.send(lines.join('\n'));
});


router.get('/sitemap.xml', async (req, res) => {
  const base = SITEMAP_BASE_URL.replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);

  // Only include real, indexable routes:
  // - /desktop is excluded (noindex duplicate of /)
  // - /services, /team, etc. are excluded (noindex anchor-redirects)
  // All core URL image slots use the real OG image from content, not
  // phantom placeholder filenames that do not exist on disk.
  const routeTemplates = [
    { path: '/',        changefreq: 'daily',   priority: '1.0', imageKey: 'home' },
    { path: '/news',    changefreq: 'weekly',  priority: '0.8', imageKey: 'news' },
    { path: '/articles',changefreq: 'weekly',  priority: '0.7', imageKey: 'articles' },
    { path: '/updates', changefreq: 'weekly',  priority: '0.7', imageKey: 'updates' },
  ];

  try {
    // Read published content so we can use the real OG image for core pages
    const contentSnapshot = await getPublishedContentSnapshot().catch(() => null);
    const contentData = contentSnapshot && contentSnapshot.data ? contentSnapshot.data : {};
    const seoData = contentData.seo || {};

    // Resolve the canonical OG image using the same validated pipeline as
    // seoInjector.js — enforces correct domain, JPEG extension, and fallback.
    const canonicalSiteUrl = getCanonicalSiteUrl();
    const rawOgImage = seoData.ogImage
      || (contentData.siteInfo && contentData.siteInfo.heroImageUrl)
      || '';
    const { finalOgImageUrl: realOgImageAbs } = resolveOgImageUrl(rawOgImage, canonicalSiteUrl);

    const postsSnapshot = await getPublishedPostsSnapshot();
    const sitemapKey = `${today}:${postsSnapshot.metadata.etag}:${realOgImageAbs}`;
    if (sitemapCache.key !== sitemapKey) {
      const posts = postsSnapshot.data;
      const coreUrls = routeTemplates.map((route) => {
        const pagePath = route.path === '/' ? '' : route.path;
        const imgMeta = SITEMAP_IMAGE_META[route.imageKey] || {
          title: route.imageKey + ' — Comprehensive Cancer Center',
          caption: 'Comprehensive Cancer Center page',
        };
        // Use the real OG image for the homepage; omit image for other core routes
        // (no phantom placeholder files that return 404)
        const imageXml = route.path === '/'
          ? buildImageXml(realOgImageAbs, imgMeta.title, imgMeta.caption)
          : '';
        return buildUrlXml({
          loc: base + pagePath,
          lastmod: today,
          changefreq: route.changefreq,
          priority: route.priority,
          imageXml,
          videoXml: '',
        });
      }).join('');

      const postUrls = posts
        .filter((post) => post && post.slug)
        .map((post) => {
          const safeSlug = encodeURIComponent(String(post.slug));
          const postLoc = base + '/posts/' + safeSlug;

          // Use self-hosted image only — reject Facebook CDN / reel URLs
          const rawImage = post.featuredImage || '';
          const selfHostedFallback = base + '/uploads/posts/' + safeSlug + '.jpg';
          const imageLoc = isSelfHostedImageUrl(toAbsoluteUrl(rawImage))
            ? rawImage
            : selfHostedFallback;

          const imageTitle   = post.seoTitle || post.title || '';
          const imageCaption = post.seoDescription || post.excerpt || '';

          // Video: only include if videoUrl is set and thumbnail is self-hosted
          const rawVideoUrl = post.videoUrl || '';
          const rawThumb    = post.videoThumbnail || post.featuredImage || selfHostedFallback;
          const videoXml = rawVideoUrl
            ? buildVideoXml(
                rawVideoUrl,
                (post.title || '') + ' Video',
                post.seoDescription || post.excerpt || '',
                rawThumb
              )
            : '';

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
    // Minimal valid fallback — no phantom image references
    res.send(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url>\n' +
      '    <loc>' + escapeXmlSanitized(base + '/') + '</loc>\n' +
      '    <lastmod>' + today + '</lastmod>\n' +
      '    <changefreq>daily</changefreq>\n' +
      '    <priority>1.0</priority>\n' +
      '  </url>\n' +
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

module.exports = router;
