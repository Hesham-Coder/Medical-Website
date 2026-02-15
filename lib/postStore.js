const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { DATA_DIR, POSTS_FILE, PUBLISHED_POSTS_FILE } = require('./config');

const POST_TYPES = ['news', 'update', 'article'];

function normalizePost(post) {
  const now = new Date().toISOString();
  return {
    id: post.id,
    title: String(post.title || ''),
    slug: String(post.slug || ''),
    type: POST_TYPES.includes(post.type) ? post.type : 'news',
    excerpt: String(post.excerpt || ''),
    content: String(post.content || ''),
    featuredImage: String(post.featuredImage || ''),
    videoUrl: String(post.videoUrl || ''),
    author: String(post.author || ''),
    tags: Array.isArray(post.tags) ? post.tags.map((t) => String(t)).filter(Boolean) : [],
    isPublished: Boolean(post.isPublished),
    isFeatured: Boolean(post.isFeatured),
    seoTitle: String(post.seoTitle || ''),
    seoDescription: String(post.seoDescription || ''),
    createdAt: post.createdAt || now,
    updatedAt: post.updatedAt || now,
  };
}

async function ensurePostsFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(POSTS_FILE);
  } catch {
    await fs.writeFile(POSTS_FILE, '[]', 'utf8');
  }
  try {
    await fs.access(PUBLISHED_POSTS_FILE);
  } catch {
    await fs.writeFile(PUBLISHED_POSTS_FILE, '[]', 'utf8');
  }
}

async function readJson(filePath, fallback) {
  const raw = await fs.readFile(filePath, 'utf8').catch(() => fallback);
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.map(normalizePost) : [];
}

async function readPosts() {
  return readJson(POSTS_FILE, '[]');
}

async function readPublishedPosts() {
  return readJson(PUBLISHED_POSTS_FILE, '[]');
}

async function backupFile(filePath, label) {
  try {
    const current = await fs.readFile(filePath, 'utf8');
    const backupFile = path.join(DATA_DIR, `${label}.${Date.now()}.json`);
    await fs.writeFile(backupFile, current, 'utf8');
  } catch (e) {
    logger.warn('Post backup skipped', { error: e.message });
  }
}

async function writePosts(posts) {
  await backupFile(POSTS_FILE, 'posts.draft.backup');
  const tmpFile = POSTS_FILE + '.tmp';
  await fs.writeFile(tmpFile, JSON.stringify(posts.map(normalizePost), null, 2), 'utf8');
  await fs.rename(tmpFile, POSTS_FILE);
}

async function syncPublishedPosts(posts) {
  const published = posts
    .filter((p) => p.isPublished)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  await backupFile(PUBLISHED_POSTS_FILE, 'posts.published.backup');
  const tmpFile = PUBLISHED_POSTS_FILE + '.tmp';
  await fs.writeFile(tmpFile, JSON.stringify(published.map(normalizePost), null, 2), 'utf8');
  await fs.rename(tmpFile, PUBLISHED_POSTS_FILE);
}

module.exports = {
  POST_TYPES,
  ensurePostsFiles,
  readPosts,
  readPublishedPosts,
  writePosts,
  syncPublishedPosts,
};
