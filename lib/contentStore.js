const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const logger = require('./logger');
const { ensurePostsFiles } = require('./postStore');
const {
  DATA_DIR,
  UPLOADS_DIR,
  CONTENT_FILE,
  PUBLISHED_CONTENT_FILE,
  USERS_FILE,
  CONTACTS_FILE,
  ADMIN_BOOTSTRAP_USERNAME,
  ADMIN_BOOTSTRAP_PASSWORD,
  ADMIN_BOOTSTRAP_EMAIL,
} = require('./config');
const {
  DEFAULT_CONTENT,
  DEFAULT_EXPERTS,
  DEFAULT_TESTIMONIALS,
} = require('./defaultContent');

function ensureExperts(content) {
  if (!content || typeof content !== 'object') return content;
  if (!content.teamSection) content.teamSection = { heading: 'World-Class Specialists', subheading: 'Our team combines decades of experience with cutting-edge research and compassionate care.' };
  if (!Array.isArray(content.experts) || content.experts.length === 0) content.experts = DEFAULT_EXPERTS.map((e) => ({ ...e }));
  if (!content.testimonialsSection) {
    content.testimonialsSection = {
      heading: { en: 'Patient Stories', ar: 'تجارب المرضى' },
      subheading: { en: 'Real feedback from patients and families we have supported.', ar: 'آراء حقيقية من مرضى وعائلات تلقوا الرعاية لدينا.' },
    };
  }
  if (!Array.isArray(content.testimonials) || content.testimonials.length === 0) content.testimonials = DEFAULT_TESTIMONIALS.map((t) => ({ ...t }));
  if (!Array.isArray(content.sectionsOrder)) content.sectionsOrder = ['hero', 'services', 'team', 'testimonials', 'about', 'contact', 'cta'];
  if (!content.sectionsOrder.includes('testimonials')) {
    const aboutIndex = content.sectionsOrder.indexOf('about');
    if (aboutIndex >= 0) content.sectionsOrder.splice(aboutIndex, 0, 'testimonials');
    else content.sectionsOrder.push('testimonials');
  }
  ['news', 'updates', 'articles'].forEach((sectionId) => {
    if (!content.sectionsOrder.includes(sectionId)) {
      const aboutIndex = content.sectionsOrder.indexOf('about');
      if (aboutIndex >= 0) content.sectionsOrder.splice(aboutIndex, 0, sectionId);
      else content.sectionsOrder.push(sectionId);
    }
  });
  if (!content.sectionVisibility || typeof content.sectionVisibility !== 'object') content.sectionVisibility = {};
  if (content.sectionVisibility.testimonials === undefined) content.sectionVisibility.testimonials = true;
  if (content.sectionVisibility.news === undefined) content.sectionVisibility.news = true;
  if (content.sectionVisibility.updates === undefined) content.sectionVisibility.updates = true;
  if (content.sectionVisibility.articles === undefined) content.sectionVisibility.articles = true;
  if (!content.insurance || typeof content.insurance !== 'object') content.insurance = {};
  if (!content.insurance.blurb) {
    content.insurance.blurb = {
      en: 'We work with a broad range of payers and will help you understand available coverage and payment options before treatment begins.',
      ar: 'نتعاون مع عدد كبير من الجهات الممولة للرعاية الصحية ونساعدك على فهم خيارات التغطية والتكاليف قبل بدء العلاج.',
    };
  }
  if (!content.insurance.coverageLinkLabel) content.insurance.coverageLinkLabel = { en: 'Check Your Coverage', ar: 'تحقق من التغطية' };
  if (!content.insurance.coverageList) content.insurance.coverageList = { en: '', ar: '' };
  return content;
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

async function initializeFiles() {
  try {
    await ensureDir(DATA_DIR);
    await ensureDir(UPLOADS_DIR);

    try {
      await fs.access(USERS_FILE);
    } catch {
      if (!ADMIN_BOOTSTRAP_PASSWORD) {
        throw new Error('ADMIN_BOOTSTRAP_PASSWORD is required when users.json is missing');
      }

      const username = ADMIN_BOOTSTRAP_USERNAME || 'admin';
      const hashedPassword = await bcrypt.hash(ADMIN_BOOTSTRAP_PASSWORD, 12);
      const now = new Date().toISOString();
      const users = {
        [username]: {
          username,
          email: ADMIN_BOOTSTRAP_EMAIL || '',
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: null,
        },
      };

      await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
      logger.info('Users file created using bootstrap environment credentials');
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

    await ensurePostsFiles();
  } catch (error) {
    logger.error('Error initializing files', { error: error.message });
    process.exit(1);
  }
}

async function readJson(file, fallback) {
  const raw = await fs.readFile(file, 'utf8').catch(() => fallback);
  return JSON.parse(raw);
}

async function readContent() {
  const content = await readJson(CONTENT_FILE, JSON.stringify(DEFAULT_CONTENT, null, 2));
  return ensureExperts(content);
}

async function readPublishedContent() {
  const content = await readJson(PUBLISHED_CONTENT_FILE, JSON.stringify(DEFAULT_CONTENT, null, 2));
  return ensureExperts(content);
}

async function backupFile(filePath, label) {
  try {
    const current = await fs.readFile(filePath, 'utf8');
    const backupFile = path.join(DATA_DIR, `${label}.${Date.now()}.json`);
    await fs.writeFile(backupFile, current);
    logger.info('Content backup', { file: path.basename(backupFile) });
  } catch (e) {
    logger.warn('Backup skip', { message: e.message });
  }
}

async function writeDraftContent(content) {
  await backupFile(CONTENT_FILE, 'content.draft.backup');
  const tmpFile = CONTENT_FILE + '.tmp';
  await fs.writeFile(tmpFile, JSON.stringify(content, null, 2), 'utf8');
  await fs.rename(tmpFile, CONTENT_FILE);
}

async function publishDraftContent() {
  const draft = await fs.readFile(CONTENT_FILE, 'utf8');
  await backupFile(PUBLISHED_CONTENT_FILE, 'content.published.backup');
  const tmpFile = PUBLISHED_CONTENT_FILE + '.tmp';
  await fs.writeFile(tmpFile, draft, 'utf8');
  await fs.rename(tmpFile, PUBLISHED_CONTENT_FILE);
}

async function readUsers() {
  return readJson(USERS_FILE, '{}');
}

async function readContacts() {
  return readJson(CONTACTS_FILE, '[]');
}

async function appendContact(record) {
  const list = await readContacts();
  if (!Array.isArray(list)) throw new Error('Invalid contacts store');
  list.push(record);
  await fs.writeFile(CONTACTS_FILE, JSON.stringify(list, null, 2));
}

module.exports = {
  initializeFiles,
  readContent,
  readPublishedContent,
  writeDraftContent,
  publishDraftContent,
  readUsers,
  readContacts,
  appendContact,
  ensureExperts,
};
