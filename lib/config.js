const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const PUBLISHED_CONTENT_FILE = path.join(DATA_DIR, 'content.published.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const ADMIN_DIR = path.join(ROOT_DIR, 'admin');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const SITE_URL = process.env.SITE_URL || 'https://www.comprehensivecancercenter.com';

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  CONTENT_FILE,
  PUBLISHED_CONTENT_FILE,
  USERS_FILE,
  CONTACTS_FILE,
  WEBSITE_DIR,
  ADMIN_DIR,
  PUBLIC_DIR,
  PORT,
  NODE_ENV,
  IS_PROD,
  SESSION_SECRET,
  SITE_URL,
};
