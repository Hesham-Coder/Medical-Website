/**
 * EXAMPLE: SSR SEO Implementation
 * These are the exact changes made to routes/public.js
 */

// ============================================
// PART 1: Import the SEO Injector
// ============================================

const express = require('express');
const { injectSeoContent } = require('../lib/seoInjector');
const { readPublishedContent } = require('../lib/contentStore');
const { promises: fs } = require('fs');

const router = express.Router();


// ============================================
// PART 2: Helper Functions
// ============================================

/**
 * Detect language from query param or Accept-Language header
 * @param {Object} req - Express request
 * @returns {string} 'en' or 'ar'
 */
function detectLanguage(req) {
  // Priority 1: Query parameter (?lang=ar)
  if (req.query && req.query.lang) {
    return req.query.lang === 'ar' ? 'ar' : 'en';
  }
  
  // Priority 2: Accept-Language header
  const acceptLang = req.headers['accept-language'] || '';
  if (acceptLang.includes('ar')) return 'ar';
  
  // Default: English
  return 'en';
}

/**
 * Read HTML file and inject SEO tags before sending
 * @param {Object} res - Express response
 * @param {string} filePath - Path to HTML file
 * @param {Object} contentData - Content object with siteInfo
 * @param {string} lang - Language ('en' or 'ar')
 */
async function serveSeoHtmlFile(res, filePath, contentData, lang = 'en') {
  try {
    // 1. Read the HTML template from disk
    let htmlContent = await fs.readFile(filePath, 'utf-8');
    
    // 2. Inject dynamic SEO tags (replaces existing meta tags)
    htmlContent = injectSeoContent(htmlContent, contentData, lang);
    
    // 3. Set response headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    
    // 4. Send the HTML with injected SEO tags
    res.send(htmlContent);
  } catch (error) {
    // Fallback: If injection fails, serve plain HTML
    console.error('SEO injection error:', error.message);
    res.sendFile(filePath);
  }
}


// ============================================
// PART 3: Updated Routes with SSR
// ============================================

/**
 * Main route: GET /
 * BEFORE: res.sendFile(path.join(WEBSITE_DIR, file));
 * AFTER: Read content + inject SEO tags
 */
router.get('/', async (req, res) => {
  try {
    // 1. Detect user's language preference
    const lang = detectLanguage(req);
    
    // 2. Read published content from database
    // This includes: siteInfo.heroHeading, heroDescription, logoUrl, etc.
    const contentData = await readPublishedContent();
    
    // 3. Determine which HTML file to serve (mobile or desktop)
    const isMobile = String(req.headers['user-agent'] || '').toLowerCase()
      .includes('mobi');
    const file = isMobile ? 'mobile.html' : 'desktop.html';
    const filePath = path.join(WEBSITE_DIR, file);
    
    // 4. Serve HTML with injected SEO tags
    await serveSeoHtmlFile(res, filePath, contentData, lang);
    
  } catch (error) {
    // Fallback: Serve plain HTML if something fails
    console.error('Error in root route:', error.message);
    const file = isMobile ? 'mobile.html' : 'desktop.html';
    res.sendFile(path.join(WEBSITE_DIR, file));
  }
});

/**
 * Desktop route: GET /desktop
 * Now injects SEO tags for search engines
 */
router.get('/desktop', async (req, res) => {
  try {
    const lang = detectLanguage(req);
    const contentData = await readPublishedContent();
    const filePath = path.join(WEBSITE_DIR, 'desktop.html');
    await serveSeoHtmlFile(res, filePath, contentData, lang);
  } catch (error) {
    console.error('Error in /desktop route:', error.message);
    res.sendFile(path.join(WEBSITE_DIR, 'desktop.html'));
  }
});


// ============================================
// PART 4: What Gets Injected (Example)
// ============================================

/**
 * INPUT from data/content.json:
 * {
 *   "siteInfo": {
 *     "heroHeading": {
 *       "en": "Science That Heals. Care That Connects.",
 *       "ar": "رعايتك تبدأ من التشخيص الدقيق"
 *     },
 *     "heroDescription": {
 *       "en": "Our multidisciplinary oncology team...",
 *       "ar": "في المركز الطبي المتكامل..."
 *     },
 *     "logoUrl": "/uploads/img-...jpg"
 *   }
 * }
 *
 * OUTPUT in HTML <head>:
 * <title>Science That Heals. Care That Connects. | Comprehensive Cancer Center</title>
 * <meta name="description" content="Our multidisciplinary oncology team...">
 * <meta property="og:title" content="Science That Heals. Care That Connects.">
 * <meta property="og:description" content="Our multidisciplinary oncology team...">
 * <meta property="og:image" content="https://example.com/uploads/img-...jpg">
 * <meta property="og:url" content="https://example.com/">
 * <meta name="twitter:card" content="summary_large_image">
 * <meta name="twitter:title" content="Science That Heals. Care That Connects.">
 * <meta name="twitter:description" content="Our multidisciplinary oncology team...">
 */


// ============================================
// PART 5: How Crawlers See It
// ============================================

/**
 * REQUEST:
 * GET / HTTP/1.1
 * User-Agent: Googlebot
 * Accept-Language: en-US
 *
 * SERVER DOES:
 * 1. detectLanguage(req) → 'en'
 * 2. readPublishedContent() → { siteInfo: { ... } }
 * 3. Read desktop.html template
 * 4. injectSeoContent(html, content, 'en')
 *    - Finds </title> tag and replaces with dynamic title
 *    - Finds <meta description> and replaces with dynamic description
 *    - Finds <meta og:*> tags and replaces with dynamic OG tags
 * 5. res.send(modifiedHtml)
 *
 * RESPONSE:
 * <html>
 * <head>
 *   <title>Science That Heals. Care That Connects. | Comprehensive Cancer Center</title>
 *   <meta name="description" content="Our multidisciplinary oncology team...">
 *   <meta property="og:title" content="Science That Heals. Care That Connects.">
 *   <meta property="og:image" content="https://example.com/uploads/img-...jpg">
 *   ... rest of HTML ...
 * </head>
 * <body>
 *   <!-- JavaScript continues to load dynamic content -->
 * </body>
 * </html>
 *
 * CRAWLER RESULT:
 * ✅ Title indexed
 * ✅ Description indexed
 * ✅ Content visible immediately (doesn't need to wait for JS)
 * ✅ OG tags available for social sharing
 */


// ============================================
// PART 6: API Endpoint Example
// ============================================

/**
 * OPTIONAL: API endpoint for checking SEO tags
 * Usage: GET /api/seo-tags?lang=en
 * 
 * Returns the exact tags that will be injected
 */
router.get('/api/seo-tags', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const contentData = await readPublishedContent();
    
    const { buildSeoTags } = require('../lib/seoInjector');
    const tags = buildSeoTags(contentData, lang);
    
    res.json({
      success: true,
      language: lang,
      tags: tags
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Example response:
 * {
 *   "success": true,
 *   "language": "en",
 *   "tags": {
 *     "title": "Science That Heals. Care That Connects. | Comprehensive Cancer Center",
 *     "metaDescription": "Our multidisciplinary oncology team designs...",
 *     "ogTitle": "Science That Heals. Care That Connects.",
 *     "ogDescription": "Our multidisciplinary oncology team designs...",
 *     "ogImage": "https://example.com/uploads/img-...jpg",
 *     "ogUrl": "https://example.com/?lang=en",
 *     "twitterTitle": "Science That Heals. Care That Connects.",
 *     "twitterDescription": "Our multidisciplinary oncology team..."
 *   }
 * }
 */


// ============================================
// PART 7: Testing Examples
// ============================================

/**
 * TEST 1: View rendered SEO tags
 * $ curl -H "User-Agent: Googlebot" https://yoursite.com/ | grep -A 1 "<title>"
 * <title>Science That Heals. Care That Connects. | Comprehensive Cancer Center</title>
 */

/**
 * TEST 2: Force Arabic language
 * $ curl https://yoursite.com/?lang=ar | grep "og:description"
 * <meta property="og:description" content="في المركز الطبي المتكامل...">
 */

/**
 * TEST 3: Check API endpoint
 * $ curl https://yoursite.com/api/seo-tags?lang=ar
 * { "success": true, "language": "ar", "tags": { ... } }
 */

/**
 * TEST 4: Verify with Google Search Console
 * 1. Go to: https://search.google.com/search-console
 * 2. URL Inspection → https://yoursite.com/
 * 3. See "Crawl & Index" and verify:
 *    - Title: "Science That Heals..."
 *    - Description: "Our multidisciplinary oncology team..."
 */

/**
 * TEST 5: Facebook Sharing Debugger
 * 1. Go to: https://developers.facebook.com/tools/debug/sharing/
 * 2. URL: https://yoursite.com/
 * 3. See:
 *    - Heading matches og:title
 *    - Description matches og:description
 *    - Image shows og:image
 */


// ============================================
// PART 8: Performance Notes
// ============================================

/**
 * Cache headers: 'public, max-age=3600' (1 hour)
 * 
 * Visitor 1 hits page:
 *   - Reads content.json
 *   - Reads HTML file
 *   - Injects SEO tags
 *   - Sends response (cached)
 *   - Duration: ~20-50ms
 * 
 * Visitor 2 hits page WITHIN 1 hour:
 *   - Server returns cached HTML (no DB read, no injection)
 *   - Duration: ~5-10ms
 * 
 * After 1 hour expires:
 *   - Fresh injection happens again
 */


module.exports = router;
