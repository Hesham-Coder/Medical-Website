const path = require('path');
require('dotenv').config({ quiet: true });

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(ROOT_DIR, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const PUBLISHED_CONTENT_FILE = path.join(DATA_DIR, 'content.published.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const PUBLISHED_POSTS_FILE = path.join(DATA_DIR, 'posts.published.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const BACKUPS_DIR = process.env.BACKUPS_DIR
  ? path.resolve(process.env.BACKUPS_DIR)
  : path.join(ROOT_DIR, 'backups');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const ADMIN_DIR = path.join(ROOT_DIR, 'admin');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const ADMIN_BOOTSTRAP_USERNAME = process.env.ADMIN_BOOTSTRAP_USERNAME || 'admin';
const ADMIN_BOOTSTRAP_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || '';
const ADMIN_BOOTSTRAP_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL || '';
const REDIS_URL = process.env.REDIS_URL || '';
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_MS || 24 * 60 * 60 * 1000);
const SITE_URL = process.env.SITE_URL || 'https://www.comprehensivecancercenter.com';

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  CONTENT_FILE,
  PUBLISHED_CONTENT_FILE,
  POSTS_FILE,
  PUBLISHED_POSTS_FILE,
  USERS_FILE,
  CONTACTS_FILE,
  BACKUPS_DIR,
  WEBSITE_DIR,
  ADMIN_DIR,
  PUBLIC_DIR,
  PORT,
  NODE_ENV,
  IS_PROD,
  SESSION_SECRET,
  ADMIN_BOOTSTRAP_USERNAME,
  ADMIN_BOOTSTRAP_PASSWORD,
  ADMIN_BOOTSTRAP_EMAIL,
  REDIS_URL,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,
  SESSION_MAX_AGE_MS,
  SITE_URL,
};
