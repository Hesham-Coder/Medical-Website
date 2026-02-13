const express = require('express');
const path = require('path');
const { WEBSITE_DIR, SITE_URL } = require('../lib/config');
const { readPublishedContent } = require('../lib/contentStore');
const { routeContact } = require('../lib/contactRouter');
const { contactLimiter } = require('../lib/security');
const { validateContact } = require('../lib/validation');
const { audit } = require('../lib/audit');
const { sendContactEmails } = require('../lib/mailer');
const { appendContact } = require('../lib/contentStore');
const logger = require('../lib/logger');

const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(WEBSITE_DIR, 'index.html'));
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(
    'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /login.html\nDisallow: /dashboard.html\nDisallow: /referral.html\nDisallow: /api/\n\nSitemap: ' +
    SITE_URL.replace(/\/$/, '') +
    '/sitemap.xml\n'
  );
});

router.get('/sitemap.xml', (req, res) => {
  const base = SITE_URL.replace(/\/$/, '');
  res.type('application/xml');
  res.send(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url><loc>' + base + '/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n' +
    '</urlset>\n'
  );
});

router.get('/api/public/content', async (req, res) => {
  try {
    const content = await readPublishedContent();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.json(content);
  } catch (error) {
    logger.error('Error reading content', { error: error.message });
    res.status(500).json({ error: 'Failed to read content' });
  }
});

router.post('/api/contacts', contactLimiter, async (req, res) => {
  try {
    const validation = validateContact(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
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
