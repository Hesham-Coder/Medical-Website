/**
 * Main application server.
 * Serves: public website (/), admin dashboard (/dashboard.html), login (/login.html), and API.
 * Content and users are stored in data/ (single source of truth).
 */
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const multer = require('multer');
const csurf = require('csurf');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./lib/logger');
const { validateContact } = require('./lib/validation');
const { audit } = require('./lib/audit');
const { sendContactEmails } = require('./lib/mailer');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const PUBLISHED_CONTENT_FILE = path.join(DATA_DIR, 'content.published.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');

// Multer: store uploads in /uploads with safe filenames
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = mime.includes('png') ? '.png' : mime.includes('gif') ? '.gif' : mime.includes('webp') ? '.webp' : '.jpg';
    cb(null, 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const ok = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
  cb(null, !!ok);
} });

// HTTPS redirect in production (trust common reverse proxies)
if (isProduction) {
  app.use((req, res, next) => {
    const proto = req.get('x-forwarded-proto');
    if (proto === 'http') {
      return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
    }
    next();
  });
}

// Security: Helmet with healthcare-appropriate CSP (allow CDNs used by frontend)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com", "https://www.googletagmanager.com", "'unsafe-inline'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      frameSrc: ["https://www.google.com"],
      connectSrc: ["'self'", "https://www.google-analytics.com", "https://www.googletagmanager.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      ...(isProduction && { upgradeInsecureRequests: [] }),
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && !sessionSecret) {
  logger.error('SESSION_SECRET is required in production. Set it in .env');
  process.exit(1);
}

app.use(session({
  secret: sessionSecret || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'cancercenter.sid',
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict',
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Block access to sensitive paths before serving static files
app.use((req, res, next) => {
  const blocked = ['/data', '/logs', '/.env', '/.git'];
  for (const b of blocked) {
    if (req.path === b || req.path.startsWith(b)) return res.status(403).send('Forbidden');
  }
  next();
});

// Default content when data/content.json is missing (e.g. first run or gitignored)
let DEFAULT_CONTENT;
try {
  DEFAULT_CONTENT = require('./data/content.json');
} catch (e) {
  DEFAULT_CONTENT = {
    siteInfo: { title: 'Comprehensive Cancer Center', tagline: 'Science That Heals. Care That Connects.', heroHeading: 'Science That Heals. Care That Connects.', heroSubheading: 'Advanced Cancer Treatment', heroDescription: 'Where cutting-edge oncology meets personalized patient care.', heroCtaPrimary: 'Schedule a Consultation', heroCtaSecondary: 'Learn More' },
    contact: { phone: '01120800011', address: '644 طريق الحرية، جناكليس، الإسكندرية', email: 'info@comprehensivecancercenter.com', emergencyPhone: '03-5865843' },
    stats: { patientsServed: 5000, successRate: 95, specialists: 50, yearsExperience: 20 },
    sectionsOrder: ['hero', 'services', 'team', 'testimonials', 'about', 'contact', 'cta'],
    sectionVisibility: { hero: true, services: true, team: true, testimonials: true, about: true, contact: true, cta: true },
    services: [{ icon: 'science', title: 'Advanced Diagnostics', description: 'State-of-the-art imaging and molecular testing.' }, { icon: 'medication', title: 'Precision Medicine', description: 'Targeted therapies tailored to your profile.' }, { icon: 'support', title: 'Holistic Support', description: 'Nutrition, mental health, survivorship programs.' }],
    aboutSection: { heading: 'Leading Cancer Care', paragraphs: ['At Comprehensive Cancer Center we address not just the disease, but the whole person.'], highlights: ['Nationally recognized specialists', 'Clinical trials', 'Supportive care'] },
    footer: { copyright: '© 2024 Comprehensive Cancer Center.', hours: 'Mon - Fri: 8:00 AM - 6:00 PM', emergencyText: '24/7 Emergency Support' },
    teamSection: { heading: 'World-Class Specialists', subheading: 'Our team combines decades of experience with cutting-edge research and compassionate care.' },
    testimonialsSection: {
      heading: { en: 'Patient Stories', ar: 'تجارب المرضى' },
      subheading: { en: 'Real feedback from patients and families we have supported.', ar: 'آراء حقيقية من مرضى وعائلات تلقوا الرعاية لدينا.' }
    },
    testimonials: [
      {
        quote: { en: 'The team explained every step clearly and supported my family throughout treatment.', ar: 'قام الفريق بشرح كل خطوة بوضوح وقدم دعمًا مستمرًا لي ولعائلتي طوال رحلة العلاج.' },
        author: { en: 'Mariam A.', ar: 'مريم أ.' },
        role: { en: 'Breast cancer survivor', ar: 'متعافية من سرطان الثدي' },
        visible: true
      }
    ],
    experts: [
      { name: 'Dr. Sarah Chen', title: 'Chief Oncologist', imageUrl: '', bio: '25+ years specializing in precision oncology and immunotherapy.', icon: 'medical_services', visible: true },
      { name: 'Dr. Michael Torres', title: 'Radiation Specialist', imageUrl: '', bio: 'Expert in advanced radiation therapy and treatment planning.', icon: 'radiology', visible: true },
      { name: 'Dr. Priya Patel', title: 'Genetic Counselor', imageUrl: '', bio: 'Leading researcher in cancer genetics and hereditary screening.', icon: 'genetics', visible: true },
      { name: 'Dr. James Wilson', title: 'Surgical Oncologist', imageUrl: '', bio: 'Pioneer in minimally invasive surgical techniques.', icon: 'surgical', visible: true }
    ]
  };
}

const DEFAULT_USERS = {
  admin: {
    username: 'admin',
    password: '$2b$10$YourHashedPasswordHere'
  }
};

const DEFAULT_EXPERTS = [
  { name: 'Dr. Sarah Chen', title: 'Chief Oncologist', imageUrl: '', bio: '25+ years specializing in precision oncology and immunotherapy.', icon: 'medical_services', visible: true },
  { name: 'Dr. Michael Torres', title: 'Radiation Specialist', imageUrl: '', bio: 'Expert in advanced radiation therapy and treatment planning.', icon: 'radiology', visible: true },
  { name: 'Dr. Priya Patel', title: 'Genetic Counselor', imageUrl: '', bio: 'Leading researcher in cancer genetics and hereditary screening.', icon: 'genetics', visible: true },
  { name: 'Dr. James Wilson', title: 'Surgical Oncologist', imageUrl: '', bio: 'Pioneer in minimally invasive surgical techniques.', icon: 'surgical', visible: true }
];

const DEFAULT_TESTIMONIALS = [
  {
    quote: { en: 'The team explained every step clearly and supported my family throughout treatment.', ar: 'قام الفريق بشرح كل خطوة بوضوح وقدم دعمًا مستمرًا لي ولعائلتي طوال رحلة العلاج.' },
    author: { en: 'Mariam A.', ar: 'مريم أ.' },
    role: { en: 'Breast cancer survivor', ar: 'متعافية من سرطان الثدي' },
    visible: true
  },
  {
    quote: { en: 'I felt safe and respected from the first consultation. The doctors coordinated everything.', ar: 'شعرت بالأمان والاحترام منذ أول استشارة، وكان تنسيق الأطباء لكل التفاصيل ممتازًا.' },
    author: { en: 'Ahmed K.', ar: 'أحمد ك.' },
    role: { en: 'Patient family member', ar: 'أحد أفراد أسرة مريض' },
    visible: true
  },
  {
    quote: { en: 'Fast diagnosis, clear plan, and compassionate care made a difficult time manageable.', ar: 'سرعة التشخيص ووضوح الخطة والرعاية الإنسانية جعلت فترة صعبة أكثر قابلية للتحمل.' },
    author: { en: 'Nour H.', ar: 'نور ح.' },
    role: { en: 'Lymphoma patient', ar: 'مريض ليمفوما' },
    visible: true
  }
];

function ensureExperts(content) {
  if (!content || typeof content !== 'object') return content;
  if (!content.teamSection) content.teamSection = { heading: 'World-Class Specialists', subheading: 'Our team combines decades of experience with cutting-edge research and compassionate care.' };
  if (!Array.isArray(content.experts) || content.experts.length === 0) content.experts = DEFAULT_EXPERTS.map(e => ({ ...e }));
  if (!content.testimonialsSection) {
    content.testimonialsSection = {
      heading: { en: 'Patient Stories', ar: 'تجارب المرضى' },
      subheading: { en: 'Real feedback from patients and families we have supported.', ar: 'آراء حقيقية من مرضى وعائلات تلقوا الرعاية لدينا.' }
    };
  }
  if (!Array.isArray(content.testimonials) || content.testimonials.length === 0) content.testimonials = DEFAULT_TESTIMONIALS.map((t) => ({ ...t }));
  if (!Array.isArray(content.sectionsOrder)) content.sectionsOrder = ['hero', 'services', 'team', 'testimonials', 'about', 'contact', 'cta'];
  if (!content.sectionsOrder.includes('testimonials')) {
    const aboutIndex = content.sectionsOrder.indexOf('about');
    if (aboutIndex >= 0) content.sectionsOrder.splice(aboutIndex, 0, 'testimonials');
    else content.sectionsOrder.push('testimonials');
  }
  if (!content.sectionVisibility || typeof content.sectionVisibility !== 'object') content.sectionVisibility = {};
  if (content.sectionVisibility.testimonials === undefined) content.sectionVisibility.testimonials = true;
  return content;
}

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

async function initializeFiles() {
  try {
    await ensureDataDir();
    await ensureUploadsDir();

    try {
      await fs.access(USERS_FILE);
    } catch {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      DEFAULT_USERS.admin.password = hashedPassword;
      await fs.writeFile(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2));
      logger.warn('Users file created. Default credentials: admin / admin123. CHANGE PASSWORD in production.');
    }

    try {
      await fs.access(CONTENT_FILE);
      logger.info('Content file found');
    } catch {
      await fs.writeFile(CONTENT_FILE, JSON.stringify(DEFAULT_CONTENT, null, 2));
      logger.info('Content file created with default content');
    }

    try {
      await fs.access(PUBLISHED_CONTENT_FILE);
      logger.info('Published content file found');
    } catch {
      // On first run, publish the current draft content
      const draft = await fs.readFile(CONTENT_FILE, 'utf8').catch(() => JSON.stringify(DEFAULT_CONTENT, null, 2));
      await fs.writeFile(PUBLISHED_CONTENT_FILE, draft);
      logger.info('Published content file created from draft');
    }

    try {
      await fs.access(CONTACTS_FILE);
    } catch {
      await fs.writeFile(CONTACTS_FILE, JSON.stringify([], null, 2));
      logger.info('Contacts file created');
    }
  } catch (error) {
    logger.error('Error initializing files', { error: error.message });
    process.exit(1);
  }
}

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// ----- Routes (defined before static so they take precedence) -----

// Public website (single page)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

app.get('/referral.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'referral.html'));
});

// Login
app.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const usersData = await fs.readFile(USERS_FILE, 'utf8');
    const users = JSON.parse(usersData);
    const user = users[username];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user.username;
    res.json({ success: true, message: 'Login successful', redirect: '/dashboard.html' });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

app.get('/api/auth/check', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ authenticated: true, username: req.session.userId });
  } else {
    res.json({ authenticated: false });
  }
});

// Contact form submission (public, rate-limited)
app.post('/api/contacts', contactLimiter, async (req, res) => {
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
    const raw = await fs.readFile(CONTACTS_FILE, 'utf8').catch(() => '[]');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error('Invalid contacts store');
    list.push(record);
    await fs.writeFile(CONTACTS_FILE, JSON.stringify(list, null, 2));
    await audit('contact_submission', { contactId: record.id });
    sendContactEmails(record).catch((err) => logger.error('Contact emails failed', { error: err.message }));
    res.status(201).json({ success: true, message: 'Thank you. We will contact you within 24 hours.' });
  } catch (err) {
    logger.error('Contact submission error', { error: err.message });
    res.status(500).json({ error: 'Unable to submit. Please try again or call us.' });
  }
});

// SEO: robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(
    'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /login.html\nDisallow: /dashboard.html\nDisallow: /referral.html\nDisallow: /api/\n\nSitemap: ' +
    (process.env.SITE_URL || 'https://www.comprehensivecancercenter.com').replace(/\/$/, '') +
    '/sitemap.xml\n'
  );
});

// SEO: sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  const base = (process.env.SITE_URL || 'https://www.comprehensivecancercenter.com').replace(/\/$/, '');
  res.type('application/xml');
  res.send(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url><loc>' + base + '/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n' +
    '</urlset>\n'
  );
});

// Public API – get content (no auth)
app.get('/api/public/content', async (req, res) => {
  try {
    const contentData = await fs.readFile(PUBLISHED_CONTENT_FILE, 'utf8');
    const content = ensureExperts(JSON.parse(contentData));
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.json(content);
  } catch (error) {
    logger.error('Error reading content', { error: error.message });
    res.status(500).json({ error: 'Failed to read content' });
  }
});

// Admin API – get content (auth required)
app.get('/api/admin/content', requireAuth, async (req, res) => {
  try {
    const contentData = await fs.readFile(CONTENT_FILE, 'utf8');
    const content = ensureExperts(JSON.parse(contentData));
    res.json(content);
  } catch (error) {
    logger.error('Error reading content (admin)', { error: error.message });
    res.status(500).json({ error: 'Failed to read content' });
  }
});

// Admin API – update content (auth required, instant save)
app.post('/api/admin/content', requireAuth, csurf(), async (req, res) => {
  try {
    const content = req.body;
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'Invalid content format' });
    }
    try {
      const currentContent = await fs.readFile(CONTENT_FILE, 'utf8');
      const backupFile = path.join(DATA_DIR, `content.draft.backup.${Date.now()}.json`);
      await fs.writeFile(backupFile, currentContent);
      logger.info('Draft content backup', { file: path.basename(backupFile) });
    } catch (e) {
      logger.warn('Draft backup skip', { message: e.message });
    }
    // Atomic write: write to temp file then rename (draft only)
    const tmpFile = CONTENT_FILE + '.tmp';
    await fs.writeFile(tmpFile, JSON.stringify(content, null, 2), 'utf8');
    await fs.rename(tmpFile, CONTENT_FILE);
    logger.info('Draft content updated');
    res.json({ success: true, message: 'Content updated successfully' });
  } catch (error) {
    logger.error('Error updating content', { error: error.message });
    res.status(500).json({ error: 'Failed to update content' });
  }
});

// CSRF token endpoint for admin UI (requires auth)
app.get('/api/admin/csrf-token', requireAuth, csurf(), (req, res) => {
  try {
    res.json({ csrfToken: req.csrfToken() });
  } catch (e) {
    res.status(500).json({ error: 'Unable to generate CSRF token' });
  }
});

// Admin API – publish draft content to live (auth + CSRF)
app.post('/api/admin/publish', requireAuth, csurf(), async (req, res) => {
  try {
    const draftContent = await fs.readFile(CONTENT_FILE, 'utf8');
    try {
      const currentPublished = await fs.readFile(PUBLISHED_CONTENT_FILE, 'utf8');
      const backupFile = path.join(DATA_DIR, `content.published.backup.${Date.now()}.json`);
      await fs.writeFile(backupFile, currentPublished);
      logger.info('Published content backup', { file: path.basename(backupFile) });
    } catch (e) {
      logger.warn('Published backup skip', { message: e.message });
    }
    const tmpFile = PUBLISHED_CONTENT_FILE + '.tmp';
    await fs.writeFile(tmpFile, draftContent, 'utf8');
    await fs.rename(tmpFile, PUBLISHED_CONTENT_FILE);
    await audit('publish_content', { user: req.session.userId || 'unknown' });
    logger.info('Content published to live');
    res.json({ success: true, message: 'Content published to live site.' });
  } catch (error) {
    logger.error('Error publishing content', { error: error.message });
    res.status(500).json({ error: 'Failed to publish content' });
  }
});

// Admin API – image upload (auth required)
app.post('/api/admin/upload', requireAuth, csurf(), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = '/uploads/' + path.basename(req.file.path);
  res.json({ success: true, url });
});

// Serve uploaded images with cache
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: isProduction ? '1d' : 0,
  setHeaders: (res) => { if (isProduction) res.setHeader('Cache-Control', 'public, max-age=86400'); },
}));

// Serve only whitelisted static directories
const websiteDir = path.join(__dirname, 'website');
const publicDir = path.join(__dirname, 'public');
const adminDir = path.join(__dirname, 'admin');
app.use('/assets', express.static(publicDir, { maxAge: isProduction ? '1d' : 0 }));
app.use('/admin-static', express.static(adminDir, { maxAge: isProduction ? '1d' : 0 }));
app.use('/', express.static(websiteDir, { maxAge: isProduction ? '1d' : 0 }));

// 404 handler
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404);
  res.sendFile(path.join(__dirname, 'website', '404.html'), (err) => {
    if (err) {
      res.type('html').send('<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>Page not found</h1><p><a href="/">Return home</a></p></body></html>');
    }
  });
});

// Central error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Server error' });
  }
  res.status(500);
  res.sendFile(path.join(__dirname, 'website', '500.html'), (e) => {
    if (e) {
      res.type('html').send('<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Something went wrong</h1><p>Please try again or call us.</p><p><a href="/">Return home</a></p></body></html>');
    }
  });
});

// Start
async function startServer() {
  await initializeFiles();
  app.listen(PORT, () => {
    logger.info('Server started', {
      port: PORT,
      website: `http://localhost:${PORT}/`,
      login: `http://localhost:${PORT}/login.html`,
      contactsApi: `http://localhost:${PORT}/api/contacts`,
    });
  });
}

startServer();
