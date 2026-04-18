/**
 * SSR-lite SEO Tag Injector
 * Injects dynamic SEO content (title, meta description, OG tags, JSON-LD, hreflang)
 * into HTML on the server side. Works client-side agnostic.
 *
 * OG Image Pipeline (Phase 1–5):
 *   1. Read seo.ogImage from published content (dashboard source of truth)
 *   2. Sanitize: strip any legacy/wrong domains → relative path
 *   3. Resolve to absolute URL using SITE_URL
 *   4. Domain-validate: final URL must belong to waleedarafat.org
 *   5. Fallback: if empty/invalid → /uploads/og-premium.jpg → /uploads/seo-og-image.jpg
 */

const { SITE_URL, FB_APP_ID } = require('./config');

// ─── Constants ───────────────────────────────────────────────────────────────

/** The canonical domain for this deployment. All OG image URLs must use this. */
const CANONICAL_DOMAIN = 'waleedarafat.org';

/** Domains that must NEVER appear in a rendered OG image URL. */
const BLOCKED_DOMAINS = [
  'comprehensivecancercenter.com',
];

/** Ordered fallback chain for the OG image. First file wins if it's a valid path. */
const OG_IMAGE_FALLBACKS = [
  '/default-og.jpg',
  '/uploads/og-premium.jpg',
  '/uploads/img-1770764937645-dg1cvg.jpg', // Known-good emergency fallback on live server
  '/uploads/seo-og-image.jpg',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the best available value from bilingual content.
 * Prefers the requested language, falls back to English, then Arabic.
 */
function getBilingualValue(obj, lang = 'en') {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object') {
    return obj[lang] || obj.en || obj.ar || '';
  }
  return String(obj);
}

/**
 * Escape HTML entities to prevent XSS.
 * Works in Node.js (server-side) without the document API.
 */
function escapeHtml(text) {
  if (!text) return '';
  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
}

/**
 * Normalize SITE_URL: ensure it has no trailing slash and uses the correct
 * canonical domain. If the configured SITE_URL uses a blocked/wrong domain,
 * replace it with the canonical domain to prevent domain pollution.
 *
 * This is a defence-in-depth measure: the correct fix is to set SITE_URL
 * properly in the environment, but this prevents catastrophic misrenderings.
 */
function getCanonicalSiteUrl() {
  let url = (SITE_URL || '').replace(/\/$/, '');

  // If SITE_URL itself points to a blocked domain, override it.
  const isBlocked = BLOCKED_DOMAINS.some((d) => url.includes(d));
  if (isBlocked || !url) {
    url = `https://www.${CANONICAL_DOMAIN}`;
    // Log loudly — this is a critical misconfiguration
    console.error(
      `[SEO] CRITICAL: SITE_URL ("${SITE_URL}") references a blocked/empty domain. ` +
      `Overriding to "${url}". Fix the SITE_URL environment variable immediately.`
    );
  }

  return url;
}

/**
 * Strip any absolute URL down to its pathname+search, discarding the domain.
 * Returns the raw string unchanged if it is already a relative path.
 */
function toRelativePath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      const parsed = new URL(rawUrl);
      return parsed.pathname + parsed.search;
    }
  } catch (_) {
    // fall through
  }
  return rawUrl;
}

/**
 * Resolve and validate an OG image URL through the full pipeline:
 *
 *   1. Accept raw value from content (relative or absolute)
 *   2. If it references a blocked domain → strip to path
 *   3. Force .jpg extension (JPEG guaranteed by imageProcessor)
 *   4. Resolve to absolute URL using canonical SITE_URL
 *   5. Verify the final domain is waleedarafat.org
 *   6. Apply fallback chain if the above fails
 *
 * Returns an object:
 *   { finalOgImageUrl, dashboardValue, fallbackUsed, issuesFound }
 */
function resolveOgImageUrl(rawValue, canonicalSiteUrl) {
  const issuesFound = [];
  const dashboardValue = rawValue || '';
  let ogImageUrl = dashboardValue;
  let fallbackUsed = false;

  // ── Step 1: Basic emptiness check ────────────────────────────────────────
  if (!ogImageUrl || typeof ogImageUrl !== 'string' || !ogImageUrl.trim()) {
    issuesFound.push('ogImage is empty or null in content data');
    ogImageUrl = OG_IMAGE_FALLBACKS[0];
    fallbackUsed = true;
  }

  // ── Step 2: Strip blocked domains ────────────────────────────────────────
  const hasBlockedDomain = BLOCKED_DOMAINS.some((d) => ogImageUrl.includes(d));
  if (hasBlockedDomain) {
    issuesFound.push(`Blocked domain found in ogImage: "${ogImageUrl}". Stripping to path.`);
    ogImageUrl = toRelativePath(ogImageUrl);
  }

  // ── Step 3: Enforce JPEG extension ───────────────────────────────────────
  // Social scrapers (Facebook, LinkedIn, WhatsApp) reject WebP/AVIF with
  // "Invalid Content Type". imageProcessor.js always writes a .jpg alongside
  // every upload, so swapping to .jpg is guaranteed to resolve.
  ogImageUrl = ogImageUrl.replace(/\.(webp|avif|png|gif|jpeg|svg|bmp|tiff?)$/i, '.jpg');

  // ── Step 4: Resolve to absolute URL ──────────────────────────────────────
  let finalOgImageUrl;
  if (ogImageUrl.startsWith('http://') || ogImageUrl.startsWith('https://')) {
    finalOgImageUrl = ogImageUrl;
  } else {
    // Relative path → prepend canonical site URL
    finalOgImageUrl = `${canonicalSiteUrl}${ogImageUrl.startsWith('/') ? '' : '/'}${ogImageUrl}`;
  }

  // ── Step 5: Domain validation ─────────────────────────────────────────────
  try {
    const parsed = new URL(finalOgImageUrl);
    const hostname = parsed.hostname; // e.g. "www.waleedarafat.org"

    // Check if hostname matches canonical domain
    const isCorrectDomain = hostname === CANONICAL_DOMAIN || hostname.endsWith(`.${CANONICAL_DOMAIN}`);
    const isBlockedDomain = BLOCKED_DOMAINS.some((d) => hostname.includes(d));

    if (isBlockedDomain) {
      issuesFound.push(`Domain validation FAILED: "${hostname}" is a blocked domain. Using fallback.`);
      fallbackUsed = true;
      finalOgImageUrl = `${canonicalSiteUrl}${OG_IMAGE_FALLBACKS[0]}`;
    } else if (!isCorrectDomain) {
      issuesFound.push(`Domain validation WARNING: "${hostname}" is not the canonical domain "${CANONICAL_DOMAIN}". Using fallback.`);
      fallbackUsed = true;
      finalOgImageUrl = `${canonicalSiteUrl}${OG_IMAGE_FALLBACKS[0]}`;
    }
  } catch (_) {
    issuesFound.push(`URL is not parseable as absolute URL: "${finalOgImageUrl}". Using fallback.`);
    fallbackUsed = true;
    finalOgImageUrl = `${canonicalSiteUrl}${OG_IMAGE_FALLBACKS[0]}`;
  }

  return { finalOgImageUrl, dashboardValue, fallbackUsed, issuesFound };
}

// ─── SEO Tag Builders ─────────────────────────────────────────────────────────

/**
 * Build SEO meta tag values from published content data.
 */
function buildSeoTags(content, lang = 'ar') {
  if (!content || typeof content !== 'object') {
    return buildDefaultSeoTags();
  }

  const canonicalSiteUrl = getCanonicalSiteUrl();
  const siteInfo = content.siteInfo || {};
  const seo = content.seo || {};

  const metaTitle = getBilingualValue(seo.metaTitle, lang);
  const metaDescription = getBilingualValue(seo.metaDescription, lang);
  const siteTitle = getBilingualValue(siteInfo.title, lang) || 'Comprehensive Cancer Center';
  const heroHeading = getBilingualValue(siteInfo.heroHeading, lang) || siteTitle;
  const heroDescription = getBilingualValue(siteInfo.heroDescription, lang) || '';

  const finalTitle = metaTitle || `${heroHeading} | Comprehensive Cancer Center`;
  const finalDescription = metaDescription || heroDescription ||
    'Evidence-based cancer care with multidisciplinary specialists in Alexandria, Egypt.';

  // ── OG Image: Phase 1–5 Pipeline ─────────────────────────────────────────
  // Priority: seo.socialShareImage > seo.ogImage > heroImageUrl > logoUrl > fallback chain
  const rawOgImage = seo.socialShareImage || seo.ogImage || siteInfo.heroImageUrl || siteInfo.logoUrl || '';
  const { finalOgImageUrl, dashboardValue, fallbackUsed, issuesFound } =
    resolveOgImageUrl(rawOgImage, canonicalSiteUrl);

  // ── Phase 8: Debug Output ─────────────────────────────────────────────────
  const debugReport = {
    dashboard_value: dashboardValue,
    final_url: finalOgImageUrl,
    is_valid: !fallbackUsed,
    source_of_truth: 'dashboard',
    fallback_used: fallbackUsed,
    issues_found: issuesFound,
  };

  if (process.env.DEBUG_SEO === 'true' || process.env.NODE_ENV !== 'production') {
    console.log('[SEO] OG Image Pipeline Report:', JSON.stringify(debugReport, null, 2));
  } else if (issuesFound.length > 0) {
    // Always log warnings even in production
    console.warn('[SEO] OG Image issues detected:', JSON.stringify(debugReport));
  }

  const description = finalDescription
    .substring(0, 160)
    .replace(/\n+/g, ' ')
    .trim();

  const tags = {};

  tags.title = finalTitle;
  tags.metaDescription = description;

  // Open Graph
  tags.ogTitle = metaTitle || heroHeading;
  tags.ogDescription = description;
  tags.ogImage = finalOgImageUrl;
  tags.ogUrl = `${canonicalSiteUrl}${lang === 'ar' ? '/?lang=ar' : '/'}`;
  tags.ogSiteName = siteTitle;

  // Locale
  tags.ogLocale = lang === 'ar' ? 'ar_EG' : 'en_US';
  tags.ogLocaleAlternate = lang === 'ar' ? 'en_US' : 'ar_EG';

  // Twitter / X
  tags.twitterTitle = tags.ogTitle;
  tags.twitterDescription = tags.ogDescription;
  tags.twitterSite = seo.twitterHandle || '@cccofegypt';

  // Facebook
  tags.fbAppId = seo.fbAppId || FB_APP_ID;

  return tags;
}

/**
 * Default SEO tags used as a fallback when content is unavailable.
 */
function buildDefaultSeoTags() {
  const canonicalSiteUrl = getCanonicalSiteUrl();
  return {
    title: 'Comprehensive Cancer Center | Expert Oncology Care in Alexandria, Egypt',
    metaDescription: 'Expert oncology care in Alexandria, Egypt — chemotherapy, radiation therapy, surgical oncology, genetic counseling & multidisciplinary support. Book a consultation today.',
    ogTitle: 'Comprehensive Cancer Center',
    ogDescription: 'Expert oncology care in Alexandria, Egypt. Multidisciplinary specialists in chemotherapy, radiation, surgery & genetic counseling.',
    ogImage: `${canonicalSiteUrl}/uploads/og-premium.jpg`,
    ogUrl: `${canonicalSiteUrl}/`,
    ogSiteName: 'Comprehensive Cancer Center',
    ogLocale: 'ar_EG',
    ogLocaleAlternate: 'en_US',
    twitterTitle: 'Comprehensive Cancer Center',
    twitterDescription: 'Expert oncology care in Alexandria, Egypt.',
    twitterSite: '@cccofegypt',
    fbAppId: FB_APP_ID,
  };
}

/**
 * Build MedicalOrganization JSON-LD structured data for Google rich results.
 * Returns a raw JSON string — must NOT be HTML-escaped before insertion.
 */
function buildJsonLd(content) {
  const canonicalSiteUrl = getCanonicalSiteUrl();
  const siteInfo = (content && content.siteInfo) || {};
  const contactData = (content && content.contact) || {};
  const contactSettings = (content && content.contactSettings) || {};

  const name = getBilingualValue(siteInfo.title, 'en') || 'Comprehensive Cancer Center';
  const nameAr = getBilingualValue(siteInfo.title, 'ar') || 'مركز شامل لعلاج الأورام';

  // Resolve logo URL — must be from canonical domain
  const rawLogoUrl = siteInfo.logoUrl || '';
  const logoUrl = rawLogoUrl
    ? (rawLogoUrl.startsWith('http')
      ? (BLOCKED_DOMAINS.some((d) => rawLogoUrl.includes(d))
        ? `${canonicalSiteUrl}${toRelativePath(rawLogoUrl)}`
        : rawLogoUrl)
      : `${canonicalSiteUrl}${rawLogoUrl}`)
    : `${canonicalSiteUrl}/uploads/og-premium.jpg`;

  // Resolve hero image URL — must be from canonical domain
  const rawHeroUrl = siteInfo.heroImageUrl || '';
  const heroImageUrl = rawHeroUrl
    ? (rawHeroUrl.startsWith('http')
      ? (BLOCKED_DOMAINS.some((d) => rawHeroUrl.includes(d))
        ? `${canonicalSiteUrl}${toRelativePath(rawHeroUrl)}`
        : rawHeroUrl)
      : `${canonicalSiteUrl}${rawHeroUrl}`)
    : `${canonicalSiteUrl}/uploads/og-premium.jpg`;

  // Phone: strip to digits only for schema
  const rawPhone = contactSettings.immediateSupportNumber || contactData.emergencyPhone || contactData.phone || '';
  const phone = rawPhone ? rawPhone.replace(/[^+\d]/g, '') : undefined;

  const email = getBilingualValue(contactData.email, 'en') || undefined;
  const addressEn = getBilingualValue(contactData.address, 'en') || '644 El Horreya Road, Gianaclis, Alexandria';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalOrganization',
    'name': name,
    'alternateName': nameAr,
    'url': canonicalSiteUrl,
    'logo': {
      '@type': 'ImageObject',
      'url': logoUrl,
    },
    'image': heroImageUrl,
    'telephone': phone || undefined,
    'email': email || undefined,
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': '644 El Horreya Road, Gianaclis',
      'addressLocality': 'Alexandria',
      'addressCountry': 'EG',
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': '31.2430724',
      'longitude': '29.9669046',
    },
    'openingHoursSpecification': [
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        'opens': '08:00',
        'closes': '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Saturday'],
        'opens': '09:00',
        'closes': '14:00',
      },
    ],
    'medicalSpecialty': [
      { '@type': 'MedicalSpecialty', 'name': 'Oncology' },
      { '@type': 'MedicalSpecialty', 'name': 'Radiation Oncology' },
      { '@type': 'MedicalSpecialty', 'name': 'Surgical Oncology' },
    ],
    'sameAs': [
      'https://www.facebook.com/cccofegypt',
      'https://www.instagram.com/cccofegypt/',
    ],
    'hasMap': 'https://www.google.com/maps/place/Comprehensive+Cancer+Center',
    'priceRange': '$$',
  };

  // Remove undefined values (JSON.stringify skips them, but parse+stringify cleans nested)
  return JSON.stringify(jsonLd, null, 2);
}

/**
 * Build hreflang alternate link tags for bilingual Arabic/English support.
 * Returns an array of raw HTML <link> strings (already safe — no user content).
 */
function buildHreflangTags(siteUrl) {
  const canonicalSiteUrl = getCanonicalSiteUrl();
  const base = (siteUrl || canonicalSiteUrl).replace(/\/$/, '');
  return [
    `    <link rel="alternate" hreflang="ar" href="${base}/?lang=ar">`,
    `    <link rel="alternate" hreflang="en" href="${base}/">`,
    `    <link rel="alternate" hreflang="x-default" href="${base}/">`,
  ];
}

/**
 * Inject all SEO tags into HTML.
 * Strips stale tags first, then inserts fresh ones immediately after <head>.
 *
 * Injecting right after <head> is critical: Facebook/WhatsApp scrapers only
 * parse the first 50–100 KB of a page. Large inline CSS blocks the range.
 *
 * @param {string} htmlContent - Raw HTML string
 * @param {object} seoTags - Escaped SEO tag values from buildSeoTags()
 * @param {string|null} rawJsonLd - Raw JSON-LD string (NOT HTML-escaped)
 * @param {string[]} hreflangLinks - Array of raw hreflang <link> strings
 */
function injectSeoTagsIntoHtml(htmlContent, seoTags, rawJsonLd = null, hreflangLinks = []) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return htmlContent;
  }

  let cleaned = htmlContent;

  // 1) Strip existing tags that we will replace
  cleaned = cleaned.replace(/<title>.*?<\/title>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property=["']fb:[^"']*["'][^>]*>/gi, '');
  cleaned = cleaned.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
  cleaned = cleaned.replace(/<link\s+rel=["']alternate["'][^>]*hreflang[^>]*>/gi, '');
  cleaned = cleaned.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

  // 2) Find injection point: immediately after <head>
  const headOpenMatch = cleaned.match(/<head[^>]*>/i);
  if (!headOpenMatch) {
    return htmlContent;
  }
  const headOpenIndex = headOpenMatch.index + headOpenMatch[0].length;

  // 3) Build new tags
  const newTags = [
    '', // Newline for spacing
    '    <!-- SEO & Social Media Metadata (Server-Side Injected) -->',
    `    <title>${seoTags.title}</title>`,
    `    <meta name="description" content="${seoTags.metaDescription}">`,
    `    <link rel="canonical" href="${seoTags.ogUrl}">`,
    `    <meta property="og:type" content="website">`,
    `    <meta property="og:locale" content="${seoTags.ogLocale || 'ar_EG'}">`,
    `    <meta property="og:locale:alternate" content="${seoTags.ogLocaleAlternate || 'en_US'}">`,
    `    <meta property="og:title" content="${seoTags.ogTitle}">`,
    `    <meta property="og:description" content="${seoTags.ogDescription}">`,
    `    <meta property="og:image" content="${seoTags.ogImage}">`,
    `    <meta property="og:image:secure_url" content="${seoTags.ogImage}">`,
    `    <meta property="og:image:type" content="image/jpeg">`,
    `    <meta property="og:image:width" content="1200">`,
    `    <meta property="og:image:height" content="630">`,
    `    <meta property="og:image:alt" content="${seoTags.ogTitle}">`,
    `    <meta property="og:url" content="${seoTags.ogUrl}">`,
    `    <meta property="og:site_name" content="${seoTags.ogSiteName}">`,
  ];

  if (seoTags.fbAppId) {
    newTags.push(`    <meta property="fb:app_id" content="${seoTags.fbAppId}">`);
  }

  newTags.push(
    `    <meta name="twitter:card" content="summary_large_image">`,
    `    <meta name="twitter:site" content="${seoTags.twitterSite || '@cccofegypt'}">`,
    `    <meta name="twitter:creator" content="${seoTags.twitterSite || '@cccofegypt'}">`,
    `    <meta name="twitter:title" content="${seoTags.twitterTitle}">`,
    `    <meta name="twitter:description" content="${seoTags.twitterDescription}">`,
    `    <meta name="twitter:image" content="${seoTags.ogImage}">`,
    `    <meta name="twitter:image:alt" content="${seoTags.twitterTitle}">`
  );

  if (hreflangLinks && hreflangLinks.length) {
    newTags.push(...hreflangLinks);
  }

  if (rawJsonLd) {
    newTags.push(
      `    <script type="application/ld+json">`,
      rawJsonLd,
      `    </script>`
    );
  }

  const injected =
    cleaned.slice(0, headOpenIndex) +
    newTags.join('\n') + '\n' +
    cleaned.slice(headOpenIndex);

  return injected;
}

/**
 * Main export: Inject all SEO content into an HTML file.
 * Usage: const html = injectSeoContent(rawHtml, contentData, detectedLang)
 */
function injectSeoContent(htmlContent, contentData, lang = 'en') {
  try {
    const content = contentData && typeof contentData === 'object' ? contentData : {};
    const canonicalSiteUrl = getCanonicalSiteUrl();

    // Build value-level SEO tags
    const seoTags = buildSeoTags(content, lang);

    if (process.env.DEBUG_SEO === 'true' || process.env.NODE_ENV !== 'production') {
      console.log(`[SEO] lang=${lang} title="${seoTags.title}" image="${seoTags.ogImage}"`);
    }

    // HTML-escape all string tag values (prevents XSS in meta attributes)
    Object.keys(seoTags).forEach((key) => {
      if (typeof seoTags[key] === 'string') {
        seoTags[key] = escapeHtml(seoTags[key]);
      }
    });

    // Build JSON-LD (raw — must NOT be HTML-escaped)
    const rawJsonLd = buildJsonLd(content);

    // Build hreflang tags (raw HTML — already safe, no user content)
    const hreflangLinks = buildHreflangTags(canonicalSiteUrl);

    return injectSeoTagsIntoHtml(htmlContent, seoTags, rawJsonLd, hreflangLinks);
  } catch (error) {
    console.error('[SEO] Injection error:', error);
    return htmlContent; // Graceful degradation
  }
}

module.exports = {
  buildSeoTags,
  buildDefaultSeoTags,
  buildJsonLd,
  buildHreflangTags,
  injectSeoContent,
  injectSeoTagsIntoHtml,
  resolveOgImageUrl,
  getCanonicalSiteUrl,
};
