const { injectSeoContent } = require('../lib/seoInjector');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const websiteDir = path.join(ROOT, 'website');
const dataDir = path.join(ROOT, 'data');

const html = fs.readFileSync(path.join(websiteDir, 'desktop.html'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(dataDir, 'content.published.json'), 'utf8'));

const result = injectSeoContent(html, content, 'ar');

// TEST CASE: Force a .webp ogImage to test fallback
const contentWithWebp = JSON.parse(JSON.stringify(content));
contentWithWebp.seo.ogImage = '/uploads/test-image.webp';
const resultWebp = injectSeoContent(html, contentWithWebp, 'ar');
const ogImageMatchWebp = resultWebp.match(/<meta property="og:image" content="(.*?)">/i);

console.log('--- TEST: FALLBACK FROM WEBP ---');
console.log('INPUT: /uploads/test-image.webp');
console.log('OUTPUT:', ogImageMatchWebp ? ogImageMatchWebp[1] : 'NOT FOUND');

const headEnd = result.indexOf('</head>');

console.log('--- SEARCHING FOR TAGS ---');
const titleMatch = result.match(/<title>.*?<\/title>/gi);
const ogTitleMatch = result.match(/<meta property="og:title" content=".*?">/gi);
const ogImageMatch = result.match(/<meta property="og:image" content=".*?">/gi);

console.log('TITLE FOUND:', titleMatch ? titleMatch[0] : 'NOT FOUND');
console.log('OG:TITLE FOUND:', ogTitleMatch ? ogTitleMatch[0] : 'NOT FOUND');
console.log('OG:IMAGE FOUND:', ogImageMatch ? ogImageMatch[0] : 'NOT FOUND');

if (titleMatch) {
    const index = result.indexOf(titleMatch[0]);
    console.log('TITLE INDEX:', index);
    console.log('HEAD END INDEX:', headEnd);
}
console.log('--- END ---');
