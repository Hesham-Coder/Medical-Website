/**
 * SSR-lite SEO Tag Injector
 * Injects dynamic SEO content (title, meta description, OG tags, JSON-LD, hreflang)
 * into HTML on the server side. Works client-side agnostic.
 */

const { SITE_URL, FB_APP_ID } = require('./config');

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
 * Build SEO meta tag values from published content data.
 */
function buildSeoTags(content, lang = 'ar') {
  if (!content || typeof content !== 'object') {
    return buildDefaultSeoTags();
  }

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

  // Priority: SEO Image Override > Hero Image > Logo > Placeholder
  let ogImageUrl = seo.ogImage || siteInfo.heroImageUrl || siteInfo.logoUrl || '/uploads/seo-og-image.jpg';

  // Enforce JPEG for all OG images — social scrapers (Facebook, LinkedIn, WhatsApp)
  // reject WebP and AVIF with "Invalid Content Type".
  // imageProcessor.js now always writes a true .jpg JPEG alongside every upload,
  // so we safely swap any extension to .jpg to hit that guaranteed-JPEG sibling.
  if (ogImageUrl && typeof ogImageUrl === 'string') {
    // Replace any image extension (webp, avif, png, gif, jpeg, jpg, svg, etc.) with .jpg
    ogImageUrl = ogImageUrl.replace(/\.(webp|avif|png|gif|jpeg|svg|bmp|tiff?)$/i, '.jpg');
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
  tags.ogImage = ogImageUrl.startsWith('http') ? ogImageUrl : `${SITE_URL}${ogImageUrl}`;
  tags.ogUrl = `${SITE_URL}${lang === 'ar' ? '/?lang=ar' : '/'}`;
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
  return {
    title: 'Comprehensive Cancer Center | Expert Oncology Care in Alexandria, Egypt',
    metaDescription: 'Expert oncology care in Alexandria, Egypt — chemotherapy, radiation therapy, surgical oncology, genetic counseling & multidisciplinary support. Book a consultation today.',
    ogTitle: 'Comprehensive Cancer Center',
    ogDescription: 'Expert oncology care in Alexandria, Egypt. Multidisciplinary specialists in chemotherapy, radiation, surgery & genetic counseling.',
    ogImage: `${SITE_URL}/uploads/seo-og-image.jpg`,
    ogUrl: `${SITE_URL}/`,
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
  const siteInfo = (content && content.siteInfo) || {};
  const contactData = (content && content.contact) || {};
  const contactSettings = (content && content.contactSettings) || {};

  const name = getBilingualValue(siteInfo.title, 'en') || 'Comprehensive Cancer Center';
  const nameAr = getBilingualValue(siteInfo.title, 'ar') || 'مركز شامل لعلاج الأورام';

  const logoUrl = siteInfo.logoUrl
    ? (siteInfo.logoUrl.startsWith('http') ? siteInfo.logoUrl : `${SITE_URL}${siteInfo.logoUrl}`)
    : `${SITE_URL}/uploads/seo-og-image.jpg`;

  const heroImageUrl = siteInfo.heroImageUrl
    ? (siteInfo.heroImageUrl.startsWith('http') ? siteInfo.heroImageUrl : `${SITE_URL}${siteInfo.heroImageUrl}`)
    : `${SITE_URL}/uploads/seo-og-image.jpg`;

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
    'url': SITE_URL,
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
  const base = (siteUrl || SITE_URL).replace(/\/$/, '');
  return [
    `    <link rel="alternate" hreflang="ar" href="${base}/?lang=ar">`,
    `    <link rel="alternate" hreflang="en" href="${base}/">`,
    `    <link rel="alternate" hreflang="x-default" href="${base}/">`,
  ];
}

/**
 * Inject all SEO tags into HTML.
 * Strips stale tags first, then inserts fresh ones before </head>.
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

  // Strip existing tags that we will replace
  cleaned = cleaned.replace(/<title>.*?<\/title>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property=["']fb:[^"']*["'][^>]*>/gi, '');
  cleaned = cleaned.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
  cleaned = cleaned.replace(/<link\s+rel=["']alternate["'][^>]*hreflang[^>]*>/gi, '');
  cleaned = cleaned.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

  const headCloseIndex = cleaned.indexOf('</head>');
  if (headCloseIndex === -1) {
    return htmlContent;
  }

  // ── Core meta tags ────────────────────────────────────────────────
  const newTags = [
    `    <title>${seoTags.title}</title>`,
    `    <meta name="description" content="${seoTags.metaDescription}">`,
    `    <link rel="canonical" href="${seoTags.ogUrl}">`,
  ];

  // ── Open Graph ───────────────────────────────────────────────────
  newTags.push(
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
    `    <meta property="og:site_name" content="${seoTags.ogSiteName}">`
  );

  if (seoTags.fbAppId) {
    newTags.push(`    <meta property="fb:app_id" content="${seoTags.fbAppId}">`);
  }

  // ── Twitter / X Card ─────────────────────────────────────────────
  newTags.push(
    `    <meta name="twitter:card" content="summary_large_image">`,
    `    <meta name="twitter:site" content="${seoTags.twitterSite || '@cccofegypt'}">`,
    `    <meta name="twitter:creator" content="${seoTags.twitterSite || '@cccofegypt'}">`,
    `    <meta name="twitter:title" content="${seoTags.twitterTitle}">`,
    `    <meta name="twitter:description" content="${seoTags.twitterDescription}">`,
    `    <meta name="twitter:image" content="${seoTags.ogImage}">`,
    `    <meta name="twitter:image:alt" content="${seoTags.twitterTitle}">`
  );

  // ── hreflang (bilingual) ──────────────────────────────────────────
  if (hreflangLinks && hreflangLinks.length) {
    newTags.push(...hreflangLinks);
  }

  // ── JSON-LD Structured Data ───────────────────────────────────────
  // Injected as raw string — must NOT be HTML-escaped
  if (rawJsonLd) {
    newTags.push(
      `    <script type="application/ld+json">`,
      rawJsonLd,
      `    </script>`
    );
  }

  const injected =
    cleaned.slice(0, headCloseIndex) +
    '\n' + newTags.join('\n') + '\n' +
    cleaned.slice(headCloseIndex);

  return injected;
}

/**
 * Main export: Inject all SEO content into an HTML file.
 * Usage: const html = injectSeoContent(rawHtml, contentData, detectedLang)
 */
function injectSeoContent(htmlContent, contentData, lang = 'en') {
  try {
    const content = contentData && typeof contentData === 'object' ? contentData : {};

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
    const hreflangLinks = buildHreflangTags(SITE_URL);

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
};
