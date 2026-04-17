const { buildSeoTags, injectSeoTagsIntoHtml } = require('./lib/seoInjector');
const fs = require('fs');
const path = require('path');

// Mock environment variables
process.env.SITE_URL = 'https://www.waleedarafat.org';
process.env.FB_APP_ID = '999999999999999';

// Mock SEO data inside a content object
const content = {
    seo: {
        metaTitle: { en: 'Test Title EN', ar: 'Test Title AR' },
        metaDescription: { en: 'Test Desc EN', ar: 'Test Desc AR' },
        ogImage: '/uploads/test-image.jpg',
        fbAppId: '123456789012345'
    }
};

const mockHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Original Title</title>
    <meta name="description" content="Original Description">
</head>
<body>
    <h1>Hello World</h1>
</body>
</html>
`;

try {
    const seoTags = buildSeoTags(content, 'en');
    console.log('--- Generated SEO Tags Object ---');
    console.log(JSON.stringify(seoTags, null, 2));

    const resultHtml = injectSeoTagsIntoHtml(mockHtml, seoTags);
    console.log('\n--- Injected HTML Head ---');
    const headMatch = resultHtml.match(/<head>([\s\S]*?)<\/head>/);
    if (headMatch) {
        console.log(headMatch[1].trim());
    } else {
        console.log('Could not find head in result');
    }

    // Check for specific tags
    const hasFbAppId = resultHtml.includes('property="fb:app_id" content="123456789012345"');
    const hasSecureUrl = resultHtml.includes('property="og:image:secure_url"');
    const hasSiteName = resultHtml.includes('property="og:site_name"');
    
    console.log('\n--- Verification Results ---');
    console.log(`fb:app_id tag: ${hasFbAppId ? 'PASS' : 'FAIL'}`);
    console.log(`og:image:secure_url tag: ${hasSecureUrl ? 'PASS' : 'FAIL'}`);
    console.log(`og:site_name tag: ${hasSiteName ? 'PASS' : 'FAIL'}`);

    if (hasFbAppId && hasSecureUrl && hasSiteName) {
        process.exit(0);
    } else {
        process.exit(1);
    }
} catch (error) {
    console.error('Verification failed with error:', error);
    process.exit(1);
}
