const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const logger = require('./logger');
const { createJsonFileStore } = require('./jsonFileStore');
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

const DRAFT_BACKUP_MIN_INTERVAL_MS = 30 * 1000;
const backupTimestamps = new Map();

function ensureContactSettings(content) {
  if (!content || typeof content !== 'object') return content;
  if (!content.contact || typeof content.contact !== 'object') content.contact = {};
  if (!content.contactSettings || typeof content.contactSettings !== 'object') content.contactSettings = {};

  const legacyPhone = String(content.contact.phone || '').trim();
  const legacyEmergency = String(content.contact.emergencyPhone || '').trim();

  if (!content.contactSettings.primaryNavbarNumber) {
    content.contactSettings.primaryNavbarNumber = legacyPhone || '+201120800011';
  }
  if (!content.contactSettings.immediateSupportNumber) {
    content.contactSettings.immediateSupportNumber =
      legacyEmergency || content.contactSettings.primaryNavbarNumber;
  }
  if (!content.contactSettings.footerGeneralContact) {
    content.contactSettings.footerGeneralContact =
      legacyPhone || content.contactSettings.primaryNavbarNumber;
  }
  if (!content.contactSettings.whatsappWelcomeMessage) {
    content.contactSettings.whatsappWelcomeMessage =
      'Hello, I would like to speak with your support team.';
  }
  if (!content.contactSettings.whatsappSupportNumber) {
    content.contactSettings.whatsappSupportNumber =
      content.contactSettings.primaryNavbarNumber;
  }

  content.contact.phone = content.contactSettings.primaryNavbarNumber;
  content.contact.emergencyPhone = content.contactSettings.immediateSupportNumber;
  return content;
}

function ensureExperts(content) {
  if (!content || typeof content !== 'object') return content;
  ensureContactSettings(content);
  if (!content.siteInfo || typeof content.siteInfo !== 'object') content.siteInfo = {};
  if (!content.siteInfo.logoName) {
    content.siteInfo.logoName = content.siteInfo.title || 'Comprehensive Cancer Center';
  }
  if (!content.teamSection) content.teamSection = { heading: 'World-Class Specialists', subheading: 'Our team combines decades of experience with cutting-edge research and compassionate care.' };
  if (!Array.isArray(content.experts) || content.experts.length === 0) content.experts = DEFAULT_EXPERTS.map((e) => ({ ...e }));
  if (!content.testimonialsSection) {
    content.testimonialsSection = {
      heading: { en: 'Patient Stories', ar: 'تجارب المرضى' },
      subheading: { en: 'Real feedback from patients and families we have supported.', ar: 'آراء حقيقية من مرضى وعائلات تلقوا الرعاية لدينا.' },
    };
  }
  if (!Array.isArray(content.testimonials) || content.testimonials.length === 0) content.testimonials = DEFAULT_TESTIMONIALS.map((t) => ({ ...t }));
  if (!Array.isArray(content.sectionsOrder)) content.sectionsOrder = ['hero', 'services', 'team', 'testimonials', 'about', 'certificates', 'contact', 'cta'];
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
  if (!content.sectionsOrder.includes('certificates')) {
    const aboutIndex = content.sectionsOrder.indexOf('about');
    if (aboutIndex >= 0) content.sectionsOrder.splice(aboutIndex + 1, 0, 'certificates');
    else content.sectionsOrder.push('certificates');
  }
  if (!content.sectionVisibility || typeof content.sectionVisibility !== 'object') content.sectionVisibility = {};
  if (content.sectionVisibility.testimonials === undefined) content.sectionVisibility.testimonials = true;
  if (content.sectionVisibility.news === undefined) content.sectionVisibility.news = true;
  if (content.sectionVisibility.updates === undefined) content.sectionVisibility.updates = true;
  if (content.sectionVisibility.articles === undefined) content.sectionVisibility.articles = true;
  if (content.sectionVisibility.certificates === undefined) content.sectionVisibility.certificates = true;
  if (!content.certificatesSection || typeof content.certificatesSection !== 'object') {
    content.certificatesSection = {
      heading: { en: 'Our Certifications', ar: 'شهاداتنا' },
      subheading: { en: 'Accreditations and quality standards we are proud to maintain.', ar: 'الاعتمادات ومعايير الجودة التي نحرص على الالتزام بها.' },
    };
  }
  if (!Array.isArray(content.certificates)) content.certificates = [];
  if (!content.insurance || typeof content.insurance !== 'object') content.insurance = {};
  if (!content.insurance.blurb) {
    content.insurance.blurb = {
      en: 'We work with a broad range of payers and will help you understand available coverage and payment options before treatment begins.',
      ar: 'نتعاون مع عدد كبير من الجهات الممولة للرعاية الصحية ونساعدك على فهم خيارات التغطية والتكاليف قبل بدء العلاج.',
    };
  }
  if (!content.insurance.coverageLinkLabel) content.insurance.coverageLinkLabel = { en: 'Check Your Coverage', ar: 'تحقق من التغطية' };
  if (!content.insurance.coverageList) content.insurance.coverageList = { en: '', ar: '' };
  if (!content.aboutSection || typeof content.aboutSection !== 'object') content.aboutSection = {};
  if (!content.aboutSection.videoTitle) {
    content.aboutSection.videoTitle = { en: 'Center Overview', ar: 'Center Overview' };
  }
  if (!content.aboutSection.videoSubtitle) {
    content.aboutSection.videoSubtitle = { en: 'Watch a short introduction.', ar: 'شاهد مقدمة قصيرة.' };
  }
  return content;
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

async function backupFile(filePath, label, options = {}) {
  const force = Boolean(options.force);
  const key = `${label}:${filePath}`;
  const now = Date.now();
  const lastBackupAt = backupTimestamps.get(key) || 0;

  if (!force && now - lastBackupAt < DRAFT_BACKUP_MIN_INTERVAL_MS) {
    return false;
  }

  try {
    const current = await fs.readFile(filePath, 'utf8');
    const backupFilePath = path.join(DATA_DIR, `${label}.${now}.json`);
    await fs.writeFile(backupFilePath, current, 'utf8');
    backupTimestamps.set(key, now);
    logger.info('Content backup', { file: path.basename(backupFilePath) });
    return true;
  } catch (e) {
    logger.warn('Backup skip', { message: e.message });
    return false;
  }
}

function normalizeContacts(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({ ...item }));
}

const draftContentStore = createJsonFileStore({
  filePath: CONTENT_FILE,
  fallbackValue: () => DEFAULT_CONTENT,
  normalize: (value) => ensureExperts(value || {}),
});

const publishedContentStore = createJsonFileStore({
  filePath: PUBLISHED_CONTENT_FILE,
  fallbackValue: () => DEFAULT_CONTENT,
  normalize: (value) => ensureExperts(value || {}),
});

const contactsStore = createJsonFileStore({
  filePath: CONTACTS_FILE,
  fallbackValue: () => [],
  normalize: normalizeContacts,
});

let contactsIndexCache = {
  key: '',
  items: [],
};

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

async function readContent() {
  return draftContentStore.read();
}

async function readPublishedContent() {
  return publishedContentStore.read();
}

async function getDraftContentSnapshot() {
  return draftContentStore.getSnapshot({ clone: true });
}

async function getPublishedContentSnapshot() {
  return publishedContentStore.getSnapshot({ clone: true });
}

async function writeDraftContent(content) {
  await draftContentStore.write(content, {
    beforeWrite: () => backupFile(CONTENT_FILE, 'content.draft.backup'),
  });
}

async function publishDraftContent() {
  const draft = await draftContentStore.read({ clone: false });
  await publishedContentStore.write(draft, {
    beforeWrite: () => backupFile(PUBLISHED_CONTENT_FILE, 'content.published.backup', { force: true }),
  });
}

async function updateContactSettings(settings) {
  const applySettings = (content) => {
    const next = content && typeof content === 'object' ? content : {};
    if (!next.contactSettings || typeof next.contactSettings !== 'object') next.contactSettings = {};
    if (!next.contact || typeof next.contact !== 'object') next.contact = {};
    next.contactSettings.primaryNavbarNumber = settings.primaryNavbarNumber;
    next.contactSettings.immediateSupportNumber = settings.immediateSupportNumber;
    next.contactSettings.footerGeneralContact = settings.footerGeneralContact;
    next.contactSettings.whatsappWelcomeMessage = settings.whatsappWelcomeMessage;
    next.contactSettings.whatsappSupportNumber = settings.whatsappSupportNumber;
    next.contact.phone = settings.primaryNavbarNumber;
    next.contact.emergencyPhone = settings.immediateSupportNumber;
    return ensureExperts(next);
  };

  await draftContentStore.update((content) => applySettings(content), {
    beforeWrite: () => backupFile(CONTENT_FILE, 'content.draft.backup'),
  });

  await publishedContentStore.update((content) => applySettings(content), {
    beforeWrite: () => backupFile(PUBLISHED_CONTENT_FILE, 'content.published.backup', { force: true }),
  });
}

async function readUsers() {
  const raw = await fs.readFile(USERS_FILE, 'utf8').catch(() => '{}');
  return JSON.parse(raw);
}

async function readContacts() {
  return contactsStore.read();
}

async function appendContact(record) {
  await contactsStore.update((list) => {
    if (!Array.isArray(list)) {
      throw new Error('Invalid contacts store');
    }
    list.push({ ...record });
  });
}

async function queryContacts(params) {
  const page = Math.max(parseInt(params && params.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(params && params.limit, 10) || 25, 5), 100);
  const search = String((params && params.search) || '').trim().toLowerCase().slice(0, 120);

  const snapshot = await contactsStore.getSnapshot({ clone: false });
  if (contactsIndexCache.key !== snapshot.metadata.etag) {
    contactsIndexCache = {
      key: snapshot.metadata.etag,
      items: snapshot.data
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map((contact) => ({
          record: contact,
          haystack: [
            contact && contact.firstName,
            contact && contact.lastName,
            contact && contact.email,
            contact && contact.phone,
            contact && contact.concern,
            contact && contact.message,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
        })),
    };
  }

  const filtered = !search
    ? contactsIndexCache.items
    : contactsIndexCache.items.filter((entry) => entry.haystack.includes(search));

  const total = filtered.length;
  const pages = Math.max(Math.ceil(total / limit), 1);
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * limit;
  const items = filtered.slice(start, start + limit).map((entry) => entry.record);

  return {
    items,
    pagination: {
      page: safePage,
      limit,
      total,
      pages,
      hasNext: safePage < pages,
    },
    metadata: snapshot.metadata,
  };
}

async function deleteContact(id) {
  if (!id) {
    throw new Error('Contact ID is required');
  }
  await contactsStore.update((list) => {
    if (!Array.isArray(list)) {
      throw new Error('Invalid contacts store');
    }
    const index = list.findIndex((entry) => entry && entry.id === id);
    if (index === -1) {
      throw new Error('Contact not found');
    }
    list.splice(index, 1);
    return list;
  });
}

async function deleteContacts(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('Contact IDs are required');
  }
  const idsToRemove = new Set(ids.filter(Boolean));
  if (!idsToRemove.size) {
    throw new Error('Contact IDs are required');
  }
  await contactsStore.update((list) => {
    if (!Array.isArray(list)) {
      throw new Error('Invalid contacts store');
    }
    return list.filter((entry) => !(entry && entry.id && idsToRemove.has(entry.id)));
  });
}

async function clearContacts() {
  await contactsStore.write([], {
    beforeWrite: () => backupFile(CONTACTS_FILE, 'contacts.clear.backup', { force: true }),
  });
}

function invalidateContentCaches() {
  draftContentStore.invalidate();
  publishedContentStore.invalidate();
  contactsStore.invalidate();
  contactsIndexCache = { key: '', items: [] };
}

module.exports = {
  initializeFiles,
  readContent,
  readPublishedContent,
  getDraftContentSnapshot,
  getPublishedContentSnapshot,
  writeDraftContent,
  publishDraftContent,
  readUsers,
  readContacts,
  appendContact,
  deleteContact,
  deleteContacts,
  clearContacts,
  queryContacts,
  invalidateContentCaches,
  ensureExperts,
  updateContactSettings,
};
