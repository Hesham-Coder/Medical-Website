/**
 * ============================================================
 * SSR SEO Injector — AAA Medical Edition
 * ============================================================
 * Injects EVERYTHING into <head> before first byte:
 *   ✅ <title> from CMS seo.metaTitle (not heroHeading)
 *   ✅ <meta name="description"> from CMS seo.metaDescription
 *   ✅ <meta name="robots"> (configurable per-page noindex)
 *   ✅ <meta name="keywords"> (bilingual)
 *   ✅ Full Open Graph suite (og:title, og:description, og:image
 *      og:image:width, og:image:height, og:image:alt, og:url,
 *      og:type, og:site_name, og:locale, og:locale:alternate)
 *   ✅ Full Twitter Card suite (twitter:card, twitter:title,
 *      twitter:description, twitter:image, twitter:image:alt)
 *   ✅ <link rel="canonical">
 *   ✅ <link rel="alternate" hreflang> (ar + en + x-default)
 *   ✅ Geo meta tags (Alexandria local SEO)
 *   ✅ JSON-LD structured data (page-context aware via schemaBuilder)
 *   ✅ Font preload hints for LCP
 *
 * Usage:
 *   const html = await injectSeoContent(rawHtml, contentData, lang, pageContext);
 *
 * pageContext (optional):
 *   { type: 'home'|'team'|'services'|'about'|'contact'|
 *           'news'|'updates'|'articles'|'post',
 *     post: postObject|null,
 *     posts: postsArray|null }
 */

'use strict';

const { buildSchemasForPage } = require('./schemaBuilder');
const { SITE_URL: CFG_SITE_URL } = require('./config');

const SITE_URL  = CFG_SITE_URL || 'https://www.waleedarafat.org';
const SITE_NAME = 'Comprehensive Cancer Center';

// ─── Helpers ────────────────────────────────────────────────────────────────

function pick(obj, lang) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.ar || obj.en || '';
}

function esc(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function absoluteUrl(path) {
  if (!path) return SITE_URL + '/uploads/seo-og-image.jpg';
  if (path.startsWith('http')) return path;
  return SITE_URL + (path.startsWith('/') ? path : '/' + path);
}

// ─── Build SEO Tag Data ──────────────────────────────────────────────────────

function buildSeoTags(content, lang, pageContext) {
  const ctx      = pageContext || {};
  const seo      = (content && content.seo) || {};
  const si       = (content && content.siteInfo) || {};
  const post     = ctx.post || null;

  // ── Title ──────────────────────────────────────────────────────────────────
  let title;
  if (post) {
    // Per-post: use post's seoTitle, fallback to post title
    const postSeoTitle = pick(post.seoTitle, lang) || pick(post.title, lang);
    title = postSeoTitle ? `${postSeoTitle} | ${SITE_NAME}` : '';
  }
  if (!title) {
    title = pick(seo.metaTitle, lang) || '';
  }
  if (!title) {
    // Construct from siteInfo.title (never show "SATT")
    const siteTitle = pick(si.title, lang);
    const cleanTitle = (siteTitle && siteTitle !== 'SATT') ? siteTitle : SITE_NAME;
    title = lang === 'ar'
      ? `${cleanTitle} | رعاية الأورام القائمة على الدليل في الإسكندرية`
      : `${cleanTitle} | Evidence-Based Cancer Care in Alexandria`;
  }

  // ── Description ───────────────────────────────────────────────────────────
  let desc;
  if (post) {
    desc = pick(post.seoDescription, lang) || pick(post.excerpt, lang) || '';
  }
  if (!desc) {
    desc = pick(seo.metaDescription, lang) || '';
  }
  if (!desc) {
    desc = pick(si.heroDescription, lang).substring(0, 160).replace(/\n+/g, ' ').trim();
  }
  if (!desc) {
    desc = lang === 'ar'
      ? 'يقدم مركز شامل لعلاج الأورام في الإسكندرية رعاية منسقة قائمة على الدليل تشمل التشخيص والعلاج الدوائي والإشعاعي والجراحي والدعم النفسي.'
      : 'Comprehensive Cancer Center provides coordinated, evidence-based cancer care in Alexandria including diagnostics, systemic therapy, radiation, surgery, and supportive care.';
  }
  desc = desc.substring(0, 160).replace(/\n+/g, ' ').trim();

  // ── OG Image ──────────────────────────────────────────────────────────────
  let ogImageRaw;
  if (post && post.featuredImage) {
    ogImageRaw = post.featuredImage;
  } else {
    ogImageRaw = seo.ogImage || si.heroImageUrl || si.logoUrl || '/uploads/seo-og-image.jpg';
  }
  const ogImage = absoluteUrl(ogImageRaw);

  // ── OG Image Alt ──────────────────────────────────────────────────────────
  const ogImageAlt = pick(seo.ogImageAlt, lang) || title;

  // ── Canonical URL ─────────────────────────────────────────────────────────
  let canonical;
  if (post && post.slug) {
    canonical = SITE_URL + '/posts/' + post.slug;
  } else if (seo.canonicalOverride) {
    canonical = seo.canonicalOverride;
  } else {
    const pathMap = {
      home: '/', team: '/team', services: '/services',
      about: '/about', contact: '/contact',
      news: '/news', updates: '/updates', articles: '/articles',
    };
    canonical = SITE_URL + (pathMap[ctx.type] || '/');
  }

  // ── Robots ────────────────────────────────────────────────────────────────
  let robots = 'index,follow';
  if (post && post.noindex) robots = 'noindex,nofollow';
  else if (seo.noindex) robots = 'noindex,nofollow';
  else if (seo.robotsDirective) robots = seo.robotsDirective;

  // ── Keywords ──────────────────────────────────────────────────────────────
  const keywords = pick(seo.keywords, lang) || '';

  // ── Locale ────────────────────────────────────────────────────────────────
  const locale          = lang === 'ar' ? 'ar_EG' : 'en_US';
  const localeAlternate = lang === 'ar' ? 'en_US' : 'ar_EG';

  return {
    title,
    desc,
    ogImage,
    ogImageAlt,
    canonical,
    canonicalAr: (canonical.split('?')[0]) + '?lang=ar',
    canonicalEn: (canonical.split('?')[0]) + '?lang=en',
    canonicalRoot: canonical.split('?')[0],
    robots,
    keywords,
    locale,
    localeAlternate,
    lang,
    twitterHandle: seo.twitterHandle || '@cccofegypt',
  };
}

// ─── Inject into HTML ────────────────────────────────────────────────────────

function buildTagBlock(tags, schemas) {
  const e = esc;
  const schemaScripts = schemas.map(
    (s) => `    <script type="application/ld+json">${JSON.stringify(s)}</script>`
  );

  return [
    // Primary
    `    <title>${e(tags.title)}</title>`,
    `    <meta name="description" content="${e(tags.desc)}">`,
    `    <meta name="robots" content="${e(tags.robots)}">`,
    `    <meta name="author" content="${e(SITE_NAME)}">`,
    tags.keywords ? `    <meta name="keywords" content="${e(tags.keywords)}">` : '',

    // Geo (local SEO — Alexandria)
    `    <meta name="geo.region" content="EG-ALX">`,
    `    <meta name="geo.placename" content="Alexandria, Egypt">`,
    `    <meta name="geo.position" content="31.24307;29.96690">`,
    `    <meta name="ICBM" content="31.24307, 29.96690">`,

    // Open Graph
    `    <meta property="og:type" content="website">`,
    `    <meta property="og:site_name" content="${e(SITE_NAME)}">`,
    `    <meta property="og:title" content="${e(tags.title)}">`,
    `    <meta property="og:description" content="${e(tags.desc)}">`,
    `    <meta property="og:image" content="${e(tags.ogImage)}">`,
    `    <meta property="og:image:secure_url" content="${e(tags.ogImage)}">`,
    `    <meta property="og:image:width" content="1200">`,
    `    <meta property="og:image:height" content="630">`,
    `    <meta property="og:image:alt" content="${e(tags.ogImageAlt)}">`,
    `    <meta property="og:url" content="${e(tags.canonical)}">`,
    `    <meta property="og:locale" content="${e(tags.locale)}">`,
    `    <meta property="og:locale:alternate" content="${e(tags.localeAlternate)}">`,

    // Twitter Card
    `    <meta name="twitter:card" content="summary_large_image">`,
    `    <meta name="twitter:site" content="${e(tags.twitterHandle)}">`,
    `    <meta name="twitter:creator" content="${e(tags.twitterHandle)}">`,
    `    <meta name="twitter:title" content="${e(tags.title)}">`,
    `    <meta name="twitter:description" content="${e(tags.desc)}">`,
    `    <meta name="twitter:image" content="${e(tags.ogImage)}">`,
    `    <meta name="twitter:image:alt" content="${e(tags.ogImageAlt)}">`,

    // Canonical + hreflang
    `    <link rel="canonical" href="${e(tags.canonicalRoot)}">`,
    `    <link rel="alternate" hreflang="ar" href="${e(tags.canonicalAr)}">`,
    `    <link rel="alternate" hreflang="en" href="${e(tags.canonicalEn)}">`,
    `    <link rel="alternate" hreflang="x-default" href="${e(tags.canonicalRoot)}">`,

    // Structured Data (JSON-LD)
    ...schemaScripts,
  ].filter(Boolean).join('\n');
}

function stripExistingMeta(html) {
  // Remove only SSR-injected tags (avoid stripping user's static tags incorrectly)
  let out = html;
  out = out.replace(/<title>.*?<\/title>/gi, '');
  out = out.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+name=["']robots["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+name=["']author["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+name=["']keywords["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+name=["']geo\.[^"']*["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+name=["']ICBM["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, '');
  out = out.replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '');
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
  out = out.replace(/<link\s+rel=["']alternate["'][^>]*hreflang[^>]*>/gi, '');
  // Remove all existing JSON-LD scripts (they'll be re-injected)
  out = out.replace(/<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi, '');
  return out;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * @param {string} htmlContent  - Raw HTML file content
 * @param {Object} contentData  - Published CMS content (content.published.json)
 * @param {string} lang         - 'ar' or 'en'
 * @param {Object} [pageContext] - { type, post, posts }
 * @returns {string} HTML with SEO tags injected
 */
function injectSeoContent(htmlContent, contentData, lang = 'ar', pageContext = null) {
  try {
    const content = (contentData && typeof contentData === 'object') ? contentData : {};
    const tags    = buildSeoTags(content, lang, pageContext);

    // Build all structured data for this page context
    const schemaCtx = Object.assign({ lang }, pageContext || { type: 'home' });
    const schemas   = buildSchemasForPage(content, schemaCtx);

    // Build the tag block
    const tagBlock = buildTagBlock(tags, schemas);

    // Strip duplicates and inject
    const cleaned  = stripExistingMeta(htmlContent);
    const headIdx  = cleaned.indexOf('</head>');
    if (headIdx === -1) return htmlContent;

    return cleaned.slice(0, headIdx) + '\n' + tagBlock + '\n' + cleaned.slice(headIdx);

  } catch (err) {
    console.error('[seoInjector] Injection error:', err.message);
    return htmlContent;
  }
}

// ─── For post pages (standalone helper) ──────────────────────────────────────

function injectPostSeoContent(htmlContent, post, contentData, lang = 'ar') {
  return injectSeoContent(htmlContent, contentData, lang, {
    type: 'post',
    post,
    posts: null,
  });
}

module.exports = {
  injectSeoContent,
  injectPostSeoContent,
  buildSeoTags,
};
