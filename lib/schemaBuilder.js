/**
 * ============================================================
 * Schema Builder — AAA Medical SEO Edition
 * ============================================================
 * Generates JSON-LD structured data per page type.
 * All schema is built server-side and injected before first byte.
 *
 * Schema types supported:
 *   - MedicalOrganization   (all pages — authority anchor)
 *   - WebSite + SearchAction (home — sitelinks search box)
 *   - Physician × N          (home, team, about)
 *   - Article / NewsArticle  (post pages)
 *   - ItemList               (listing pages: news, articles, updates)
 *   - FAQPage                (when faqItems exist in SEO data)
 *   - MedicalWebPage         (services, about, contact)
 *   - BreadcrumbList         (all pages except home)
 */

'use strict';

const { SITE_URL: CFG_SITE_URL } = require('./config');
const SITE_URL = CFG_SITE_URL || 'https://www.waleedarafat.org';
const SITE_NAME = 'Comprehensive Cancer Center';

// ─── Helpers ────────────────────────────────────────────────────────────────

function pick(obj, lang) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.ar || obj.en || '';
}

function absoluteUrl(path) {
  if (!path) return SITE_URL;
  if (path.startsWith('http')) return path;
  return SITE_URL + (path.startsWith('/') ? path : '/' + path);
}

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function truncate(str, max) {
  const s = String(str || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ─── Core: MedicalOrganization ───────────────────────────────────────────────

function buildMedicalOrgSchema(content) {
  const contact  = (content && content.contact) || {};
  const si       = (content && content.siteInfo) || {};
  const cs       = (content && content.contactSettings) || {};
  const seo      = (content && content.seo) || {};

  const phone    = cs.primaryNavbarNumber || contact.phone || '';
  const emergency = cs.immediateSupportNumber || contact.emergencyPhone || phone;
  const email    = pick(contact.email, 'en') || 'info@comprehensivecancercenter.com';
  const logoRaw  = seo.ogImage || si.logoUrl || '/uploads/seo-og-image.jpg';
  const logo     = absoluteUrl(logoRaw);

  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalOrganization',
    '@id': SITE_URL + '/#organization',
    name: SITE_NAME,
    alternateName: 'مركز شامل لعلاج الأورام',
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: logo, width: 400, height: 400 },
    image: logo,
    description: 'Comprehensive Cancer Center provides coordinated, evidence-based cancer care in Alexandria, Egypt, including multidisciplinary assessment, systemic therapy, radiation, surgery, genetic counseling, and supportive care.',
    telephone: phone,
    email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '644 El Horreya Road',
      addressLocality: 'Alexandria',
      addressRegion: 'ALX',
      postalCode: '21599',
      addressCountry: 'EG',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: '31.24307',
      longitude: '29.96690',
    },
    hasMap: 'https://maps.google.com/?cid=16787777076898414319',
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        opens: '08:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Friday'],
        opens: '09:00',
        closes: '14:00',
      },
    ],
    medicalSpecialty: ['Oncology', 'Radiation Oncology', 'Surgical Oncology'],
    availableService: [
      { '@type': 'MedicalTherapy', name: 'Multidisciplinary Cancer Assessment' },
      { '@type': 'MedicalTherapy', name: 'Systemic Therapies (Chemotherapy & Immunotherapy)' },
      { '@type': 'MedicalTherapy', name: 'Radiation Oncology' },
      { '@type': 'MedicalTherapy', name: 'Genetic Risk Evaluation' },
      { '@type': 'MedicalTherapy', name: 'Supportive & Palliative Care' },
      { '@type': 'MedicalTherapy', name: 'Clinical Research Access' },
    ],
    sameAs: [
      'https://www.facebook.com/cccofegypt',
      'https://www.instagram.com/cccofegypt/',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: phone,
        contactType: 'customer service',
        areaServed: 'EG',
        availableLanguage: ['Arabic', 'English'],
      },
      {
        '@type': 'ContactPoint',
        telephone: emergency,
        contactType: 'emergency',
        contactOption: 'TollFree',
        areaServed: 'EG',
        availableLanguage: ['Arabic', 'English'],
      },
    ],
    priceRange: '$$',
    currenciesAccepted: 'EGP',
    paymentAccepted: 'Cash, Insurance',
    foundingDate: '2019',
    areaServed: [
      { '@type': 'City', name: 'Alexandria', '@id': 'https://www.wikidata.org/wiki/Q87' },
      { '@type': 'Country', name: 'Egypt', '@id': 'https://www.wikidata.org/wiki/Q79' },
    ],
  };
}

// ─── WebSite + SearchAction ───────────────────────────────────────────────────

function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_URL + '/#website',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: ['ar', 'en'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: SITE_URL + '/news?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

// ─── Physician ───────────────────────────────────────────────────────────────

function buildPhysicianSchemas(content) {
  const experts = (content && content.experts) || [];
  return experts
    .filter((e) => e && e.name && e.visible !== false)
    .map((e) => ({
      '@context': 'https://schema.org',
      '@type': 'Physician',
      '@id': SITE_URL + '/#physician-' + encodeURIComponent(String(e.name || '').replace(/\s+/g, '-').toLowerCase()),
      name: e.name,
      honorificPrefix: 'Prof.',
      jobTitle: e.title || 'Oncologist',
      description: truncate(stripHtml(e.bio || ''), 300),
      image: absoluteUrl(e.imageUrl || ''),
      telephone: ((content && content.contactSettings) || {}).primaryNavbarNumber || '',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '644 El Horreya Road',
        addressLocality: 'Alexandria',
        addressCountry: 'EG',
      },
      worksFor: {
        '@type': 'MedicalOrganization',
        '@id': SITE_URL + '/#organization',
        name: SITE_NAME,
      },
      medicalSpecialty: 'Oncology',
      url: SITE_URL,
    }));
}

// ─── Article / NewsArticle (for individual posts) ────────────────────────────

function buildArticleSchema(post, content, lang) {
  const si     = (content && content.siteInfo) || {};
  const seo    = (content && content.seo) || {};
  const logoRaw = seo.ogImage || si.logoUrl || '/uploads/seo-og-image.jpg';
  const logo   = absoluteUrl(logoRaw);
  const slug   = post.slug || '';
  const url    = SITE_URL + '/posts/' + slug;
  const image  = absoluteUrl(post.featuredImage || logoRaw);

  const title  = pick(post.seoTitle, lang) || pick(post.title, lang) || 'Article';
  const desc   = pick(post.seoDescription, lang) || pick(post.excerpt, lang) || '';

  // Determine schema type based on post type
  const schemaType = post.type === 'article' ? 'Article' : 'NewsArticle';

  return {
    '@context': 'https://schema.org',
    '@type': schemaType,
    '@id': url + '#article',
    headline: truncate(title, 110),
    description: truncate(desc, 300),
    url,
    image: {
      '@type': 'ImageObject',
      url: image,
      width: 1200,
      height: 630,
    },
    datePublished: post.createdAt || new Date().toISOString(),
    dateModified: post.updatedAt || post.createdAt || new Date().toISOString(),
    inLanguage: lang === 'ar' ? 'ar-EG' : 'en-US',
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: logo, width: 400, height: 400 },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: { '@id': SITE_URL + '/#website' },
  };
}

// ─── BreadcrumbList ───────────────────────────────────────────────────────────

function buildBreadcrumbSchema(items) {
  // items: [{ name, url }]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ─── FAQPage ──────────────────────────────────────────────────────────────────

function buildFaqSchema(faqItems, lang) {
  if (!faqItems || !faqItems.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: pick(item.question, lang),
      acceptedAnswer: {
        '@type': 'Answer',
        text: stripHtml(pick(item.answer, lang)),
      },
    })),
  };
}

// ─── ItemList (for listing pages) ─────────────────────────────────────────────

function buildItemListSchema(posts, pageUrl, lang) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    url: pageUrl,
    itemListElement: posts.slice(0, 10).map((post, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: SITE_URL + '/posts/' + (post.slug || ''),
      name: pick(post.title, lang) || '',
    })),
  };
}

// ─── MedicalWebPage ────────────────────────────────────────────────────────────

function buildMedicalWebPageSchema(title, url, description) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    name: title,
    url,
    description,
    inLanguage: ['ar', 'en'],
    audience: { '@type': 'Audience', audienceType: 'Patient' },
    isPartOf: { '@id': SITE_URL + '/#website' },
    about: { '@id': SITE_URL + '/#organization' },
  };
}

// ─── Master builder: per-page-context ─────────────────────────────────────────

/**
 * pageContext = {
 *   type: 'home' | 'team' | 'services' | 'news' | 'updates' | 'articles' | 'about' | 'contact' | 'post' | '404',
 *   post: Object|null,    // for 'post' type
 *   posts: Array|null,    // for listing pages
 *   lang: 'ar'|'en',
 * }
 */
function buildSchemasForPage(content, pageContext) {
  const type   = (pageContext && pageContext.type)  || 'home';
  const lang   = (pageContext && pageContext.lang)  || 'ar';
  const post   = (pageContext && pageContext.post)  || null;
  const posts  = (pageContext && pageContext.posts) || null;
  const seo    = (content && content.seo) || {};

  const orgSchema     = buildMedicalOrgSchema(content);
  const websiteSchema = buildWebSiteSchema();
  const schemas       = [];

  switch (type) {
    case 'home': {
      schemas.push(orgSchema, websiteSchema);
      schemas.push(...buildPhysicianSchemas(content));

      // FAQs if present in SEO config
      const faqItems = seo.faqItems || [];
      if (faqItems.length) {
        const faqSchema = buildFaqSchema(faqItems, lang);
        if (faqSchema) schemas.push(faqSchema);
      }
      break;
    }

    case 'team': {
      schemas.push(orgSchema);
      schemas.push(...buildPhysicianSchemas(content));
      schemas.push(buildBreadcrumbSchema([
        { name: 'Home', url: SITE_URL + '/' },
        { name: lang === 'ar' ? 'فريق الأطباء' : 'Our Team', url: SITE_URL + '/team' },
      ]));
      break;
    }

    case 'services': {
      schemas.push(orgSchema);
      schemas.push(buildMedicalWebPageSchema(
        lang === 'ar' ? 'خدمات علاج الأورام' : 'Cancer Treatment Services',
        SITE_URL + '/services',
        lang === 'ar' ? 'خدمات علاج الأورام في مركز شامل بالإسكندرية' : 'Cancer treatment services at Comprehensive Cancer Center in Alexandria'
      ));
      schemas.push(buildBreadcrumbSchema([
        { name: 'Home', url: SITE_URL + '/' },
        { name: lang === 'ar' ? 'الخدمات' : 'Services', url: SITE_URL + '/services' },
      ]));
      break;
    }

    case 'about': {
      schemas.push(orgSchema);
      schemas.push(buildMedicalWebPageSchema(
        lang === 'ar' ? 'عن المركز' : 'About Comprehensive Cancer Center',
        SITE_URL + '/about',
        lang === 'ar' ? 'تعرف على مركز شامل لعلاج الأورام في الإسكندرية' : 'About Comprehensive Cancer Center in Alexandria, Egypt'
      ));
      schemas.push(buildBreadcrumbSchema([
        { name: 'Home', url: SITE_URL + '/' },
        { name: lang === 'ar' ? 'عن المركز' : 'About', url: SITE_URL + '/about' },
      ]));
      break;
    }

    case 'contact': {
      schemas.push(orgSchema);
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: lang === 'ar' ? 'تواصل معنا' : 'Contact Comprehensive Cancer Center',
        url: SITE_URL + '/contact',
        isPartOf: { '@id': SITE_URL + '/#website' },
      });
      schemas.push(buildBreadcrumbSchema([
        { name: 'Home', url: SITE_URL + '/' },
        { name: lang === 'ar' ? 'تواصل معنا' : 'Contact', url: SITE_URL + '/contact' },
      ]));
      break;
    }

    case 'news':
    case 'updates':
    case 'articles': {
      schemas.push(orgSchema);
      if (posts && posts.length) {
        schemas.push(buildItemListSchema(posts, SITE_URL + '/' + type, lang));
      }
      const labelMap = {
        news: { ar: 'الأخبار', en: 'News' },
        updates: { ar: 'المستجدات', en: "What's New" },
        articles: { ar: 'المقالات', en: 'Articles' },
      };
      schemas.push(buildBreadcrumbSchema([
        { name: 'Home', url: SITE_URL + '/' },
        { name: lang === 'ar' ? labelMap[type].ar : labelMap[type].en, url: SITE_URL + '/' + type },
      ]));
      break;
    }

    case 'post': {
      schemas.push(orgSchema);
      if (post) {
        schemas.push(buildArticleSchema(post, content, lang));
        // Breadcrumb based on post type
        const postTypeLabelMap = {
          news:    { ar: 'الأخبار',    en: 'News' },
          update:  { ar: 'المستجدات', en: "What's New" },
          article: { ar: 'المقالات',  en: 'Articles' },
        };
        const postTypeKey  = post.type || 'news';
        const parentLabel  = lang === 'ar'
          ? (postTypeLabelMap[postTypeKey] || postTypeLabelMap.news).ar
          : (postTypeLabelMap[postTypeKey] || postTypeLabelMap.news).en;
        const parentPath   = postTypeKey === 'update' ? '/updates' : '/' + postTypeKey + 's';

        schemas.push(buildBreadcrumbSchema([
          { name: 'Home', url: SITE_URL + '/' },
          { name: parentLabel, url: SITE_URL + parentPath },
          { name: pick(post.title, lang) || 'Post', url: SITE_URL + '/posts/' + (post.slug || '') },
        ]));
      }
      break;
    }

    default: {
      // 404 and unknown pages: minimal schema
      schemas.push(orgSchema);
      break;
    }
  }

  return schemas.filter(Boolean);
}

module.exports = {
  buildSchemasForPage,
  buildMedicalOrgSchema,
  buildWebSiteSchema,
  buildPhysicianSchemas,
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildItemListSchema,
  buildMedicalWebPageSchema,
};
