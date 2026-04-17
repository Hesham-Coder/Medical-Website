/**
 * SSR-lite SEO Tag Injector
 * Injects dynamic SEO content (title, meta description, OG tags) into HTML
 * Works client-side agnostic - doesn't interfere with existing JS
 */

const { SITE_URL } = require('./config');

/**
 * Get the best available value from bilingual content
 * Defaults to English if both exist, falls back to available language
 */
function getBilingualValue(obj, lang = 'en') {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object') {
    // Prefer requested language, fallback to English, fallback to Arabic
    return obj[lang] || obj.en || obj.ar || '';
  }
  return String(obj);
}

/**
 * Escape HTML entities to prevent XSS
 * Works in Node.js (server-side) without document API
 */
function escapeHtml(text) {
  if (!text) return '';
  
  // Use a simple character replacement map for HTML entities
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
 * Build SEO meta tags for injection into HTML
 */
function buildSeoTags(content, lang = 'ar') {
  if (!content || typeof content !== 'object') {
    return buildDefaultSeoTags();
  }

  const siteInfo = content.siteInfo || {};
  const seo = content.seo || {};

  // 1. Get Values (supports both strings and bilingual objects)
  const metaTitle = getBilingualValue(seo.metaTitle, lang);
  const metaDescription = getBilingualValue(seo.metaDescription, lang);
  const siteTitle = getBilingualValue(siteInfo.title, lang) || 'Comprehensive Cancer Center';
  const heroHeading = getBilingualValue(siteInfo.heroHeading, lang) || siteTitle;
  const heroDescription = getBilingualValue(siteInfo.heroDescription, lang) || '';
  
  // 2. Resolve Final Title and Description
  // If metaTitle is provided, it's usually a full optimized title, so use it as is.
  const finalTitle = metaTitle || `${heroHeading} | Comprehensive Cancer Center`;
  const finalDescription = metaDescription || heroDescription || 
    'Evidence-based cancer care with multidisciplinary specialists in Alexandria.';

  // 3. Resolve Image
  // Priority: SEO Image Override > Hero Background Image > Site Logo > Placeholder
  let logoUrl = seo.ogImage || siteInfo.heroImageUrl || siteInfo.logoUrl || '/uploads/seo-og-image.jpg';
  
  // Ensure we use a compatible format (JPG) for Open Graph images 
  // to avoid "Invalid Content Type" errors on Facebook/LinkedIn/etc.
  if (logoUrl && typeof logoUrl === 'string' && /\.(webp|avif)$/i.test(logoUrl)) {
    logoUrl = logoUrl.replace(/\.(webp|avif)$/i, '.jpg');
  }
  
  // 4. Truncate for SEO safety
  const description = finalDescription
    .substring(0, 160)
    .replace(/\n+/g, ' ')
    .trim();

  const tags = {};

  // Title tag
  tags.title = finalTitle;

  // Meta description
  tags.metaDescription = description;

  // Open Graph tags
  tags.ogTitle = metaTitle || heroHeading;
  tags.ogDescription = description;
  tags.ogImage = logoUrl.startsWith('http') ? logoUrl : `${SITE_URL}${logoUrl}`;
  tags.ogUrl = `${SITE_URL}${lang === 'ar' ? '?lang=ar' : ''}`;

  // Twitter card
  tags.twitterTitle = tags.ogTitle;
  tags.twitterDescription = tags.ogDescription;

  return tags;
}

/**
 * Default SEO tags if content not available
 */
function buildDefaultSeoTags() {
  return {
    title: 'Comprehensive Cancer Center | Evidence-Based Cancer Care',
    metaDescription: 'Comprehensive Cancer Center provides coordinated, evidence-based cancer care in Alexandria.',
    ogTitle: 'Comprehensive Cancer Center',
    ogDescription: 'Evidence-based cancer care with multidisciplinary specialists.',
    ogImage: `${SITE_URL}/uploads/seo-og-image.jpg`,
    ogUrl: SITE_URL,
    twitterTitle: 'Comprehensive Cancer Center',
    twitterDescription: 'Evidence-based cancer care in Alexandria',
  };
}

/**
 * Inject SEO tags into HTML
 * Replaces existing meta tags in the <head>
 */
function injectSeoTagsIntoHtml(htmlContent, seoTags) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return htmlContent;
  }

  // Remove existing meta tags (title, description, og:*, twitter:*)
  let cleaned = htmlContent;

  // Remove title tags
  cleaned = cleaned.replace(/<title>.*?<\/title>/gi, '');

  // Remove existing meta description
  cleaned = cleaned.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');

  // Remove existing og: tags
  cleaned = cleaned.replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, '');

  // Remove existing twitter: tags
  cleaned = cleaned.replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '');

  // Remove existing canonical tags
  cleaned = cleaned.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');

  // Find </head> tag IN THE CLEANED HTML
  const headCloseIndex = cleaned.indexOf('</head>');
  if (headCloseIndex === -1) {
    return htmlContent;
  }

  // Build new tags
  const newTags = [
    `    <title>${seoTags.title}</title>`,
    `    <meta name="description" content="${seoTags.metaDescription}">`,
    `    <link rel="canonical" href="${seoTags.ogUrl}">`,
    `    <meta property="og:type" content="website">`,
    `    <meta property="og:title" content="${seoTags.ogTitle}">`,
    `    <meta property="og:description" content="${seoTags.ogDescription}">`,
    `    <meta property="og:image" content="${seoTags.ogImage}">`,
    `    <meta property="og:image:width" content="1200">`,
    `    <meta property="og:image:height" content="630">`,
    `    <meta property="og:image:alt" content="${seoTags.ogTitle}">`,
    `    <meta property="og:url" content="${seoTags.ogUrl}">`,
    `    <meta name="twitter:card" content="summary_large_image">`,
    `    <meta name="twitter:title" content="${seoTags.twitterTitle}">`,
    `    <meta name="twitter:description" content="${seoTags.twitterDescription}">`,
    `    <meta name="twitter:image" content="${seoTags.ogImage}">`,
    `    <meta name="twitter:image:alt" content="${seoTags.twitterTitle}">`,
  ];

  // Insert new tags before </head>
  const injected = cleaned.slice(0, headCloseIndex) + 
    '\n' + newTags.join('\n') + '\n' +
    cleaned.slice(headCloseIndex);

  return injected;
}

/**
 * Main export: Process HTML response with SEO tags
 * Usage: const processed = injectSeoContent(htmlFile, contentData, detectedLang)
 */
function injectSeoContent(htmlContent, contentData, lang = 'en') {
  try {
    // Escape all content to prevent XSS
    const content = contentData && typeof contentData === 'object' ? contentData : {};
    
    // Build SEO tags from dynamic content
    const seoTags = buildSeoTags(content, lang);
    
    // Log active SEO tags for debugging
    if (process.env.DEBUG_SEO === 'true' || process.env.NODE_ENV !== 'production') {
      console.log(`[SEO Debug] Lang: ${lang}, Title: ${seoTags.title}, Image: ${seoTags.ogImage}`);
    }
    
    // Escape all tag values for safe HTML injection
    Object.keys(seoTags).forEach((key) => {
      if (typeof seoTags[key] === 'string') {
        seoTags[key] = escapeHtml(seoTags[key]);
      }
    });

    // Inject tags into HTML
    return injectSeoTagsIntoHtml(htmlContent, seoTags);
  } catch (error) {
    console.error('SEO injection error:', error);
    // Return original HTML on error
    return htmlContent;
  }
}

module.exports = {
  buildSeoTags,
  injectSeoContent,
  buildDefaultSeoTags,
};
