const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { createJsonFileStore } = require('./jsonFileStore');
const { DATA_DIR, POSTS_FILE, PUBLISHED_POSTS_FILE } = require('./config');

const POST_TYPES = ['news', 'update', 'article'];
const DRAFT_BACKUP_MIN_INTERVAL_MS = 30 * 1000;
const backupTimestamps = new Map();

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

function sortPostsByDate(posts) {
  return posts
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function normalizePosts(posts) {
  const list = Array.isArray(posts) ? posts.map(normalizePost) : [];
  return sortPostsByDate(list);
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
    return true;
  } catch (e) {
    logger.warn('Post backup skipped', { error: e.message });
    return false;
  }
}

const draftPostsStore = createJsonFileStore({
  filePath: POSTS_FILE,
  fallbackValue: () => [],
  normalize: normalizePosts,
});

const publishedPostsStore = createJsonFileStore({
  filePath: PUBLISHED_POSTS_FILE,
  fallbackValue: () => [],
  normalize: normalizePosts,
});

let draftIndexCache = { key: '', index: null };
let publishedIndexCache = { key: '', index: null };

function buildSearchText(post) {
  return [
    post.title,
    post.excerpt,
    post.author,
    Array.isArray(post.tags) ? post.tags.join(' ') : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function buildIndex(posts) {
  const list = normalizePosts(posts);
  const byId = new Map();
  const bySlug = new Map();
  const searchable = [];
  const featuredByType = new Map();
  const queryCache = new Map();

  list.forEach((post) => {
    byId.set(post.id, post);
    bySlug.set(post.slug, post);
    searchable.push({
      post,
      haystack: buildSearchText(post),
    });
    if (post.isFeatured && !featuredByType.has(post.type)) {
      featuredByType.set(post.type, post);
    }
  });

  return {
    list,
    byId,
    bySlug,
    searchable,
    featuredByType,
    queryCache,
  };
}

async function getIndexedSnapshot(published) {
  const store = published ? publishedPostsStore : draftPostsStore;
  const snapshot = await store.getSnapshot({ clone: false });
  const cache = published ? publishedIndexCache : draftIndexCache;

  if (cache.key !== snapshot.metadata.etag || !cache.index) {
    const nextCache = {
      key: snapshot.metadata.etag,
      index: buildIndex(snapshot.data),
    };

    if (published) {
      publishedIndexCache = nextCache;
    } else {
      draftIndexCache = nextCache;
    }

    return {
      metadata: snapshot.metadata,
      index: nextCache.index,
    };
  }

  return {
    metadata: snapshot.metadata,
    index: cache.index,
  };
}

function queryIndex(index, query, options = {}) {
  const type = query && query.type ? String(query.type).toLowerCase().trim() : '';
  const page = Math.max(parseInt(query && query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query && query.limit, 10) || 6, 1), 24);
  const search = String((query && query.search) || '').trim().toLowerCase().slice(0, 80);
  const includeFeatured = Boolean(options.includeFeatured);

  const cacheKey = `${type}|${search}|${page}|${limit}|${includeFeatured ? 1 : 0}`;
  if (index.queryCache.has(cacheKey)) {
    return index.queryCache.get(cacheKey);
  }

  const source = !type && !search
    ? index.list
    : index.searchable
      .filter((entry) => {
        if (type && entry.post.type !== type) return false;
        if (search && !entry.haystack.includes(search)) return false;
        return true;
      })
      .map((entry) => entry.post);

  const total = source.length;
  const pages = Math.max(Math.ceil(total / limit), 1);
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * limit;

  const result = {
    items: source.slice(start, start + limit),
    pagination: {
      page: safePage,
      limit,
      total,
      pages,
      hasNext: safePage < pages,
    },
  };

  if (includeFeatured) {
    result.featuredItem = (type && index.featuredByType.get(type)) || source.find((post) => post.isFeatured) || source[0] || null;
  }

  if (index.queryCache.size > 100) {
    const firstKey = index.queryCache.keys().next().value;
    index.queryCache.delete(firstKey);
  }
  index.queryCache.set(cacheKey, result);

  return result;
}

async function readPosts() {
  return draftPostsStore.read();
}

async function readPublishedPosts() {
  return publishedPostsStore.read();
}

async function getDraftPostsSnapshot() {
  return draftPostsStore.getSnapshot({ clone: true });
}

async function getPublishedPostsSnapshot() {
  return publishedPostsStore.getSnapshot({ clone: true });
}

async function queryPosts(query) {
  const snapshot = await getIndexedSnapshot(false);
  return {
    ...queryIndex(snapshot.index, query),
    metadata: snapshot.metadata,
  };
}

async function queryPublishedPosts(query, options) {
  const snapshot = await getIndexedSnapshot(true);
  return {
    ...queryIndex(snapshot.index, query, options),
    metadata: snapshot.metadata,
  };
}

async function getDraftPostBySlug(slug) {
  const snapshot = await getIndexedSnapshot(false);
  return snapshot.index.bySlug.get(String(slug || '').trim().toLowerCase()) || null;
}

async function getPublishedPostBySlug(slug) {
  const snapshot = await getIndexedSnapshot(true);
  return snapshot.index.bySlug.get(String(slug || '').trim().toLowerCase()) || null;
}

async function getDraftPostById(id) {
  const snapshot = await getIndexedSnapshot(false);
  return snapshot.index.byId.get(String(id || '').trim()) || null;
}

async function writePosts(posts) {
  await draftPostsStore.write(posts, {
    beforeWrite: () => backupFile(POSTS_FILE, 'posts.draft.backup'),
  });
}

async function syncPublishedPosts(posts) {
  const published = normalizePosts(posts).filter((post) => post.isPublished);
  await publishedPostsStore.write(published, {
    beforeWrite: () => backupFile(PUBLISHED_POSTS_FILE, 'posts.published.backup', { force: true }),
  });
}

async function persistPosts(posts) {
  const sorted = normalizePosts(posts);
  await draftPostsStore.write(sorted, {
    beforeWrite: () => backupFile(POSTS_FILE, 'posts.draft.backup'),
  });
  await publishedPostsStore.write(sorted.filter((post) => post.isPublished), {
    beforeWrite: () => backupFile(PUBLISHED_POSTS_FILE, 'posts.published.backup', { force: true }),
  });
  return sorted;
}

function invalidatePostsCache() {
  draftPostsStore.invalidate();
  publishedPostsStore.invalidate();
  draftIndexCache = { key: '', index: null };
  publishedIndexCache = { key: '', index: null };
}

module.exports = {
  POST_TYPES,
  ensurePostsFiles,
  readPosts,
  readPublishedPosts,
  getDraftPostsSnapshot,
  getPublishedPostsSnapshot,
  queryPosts,
  queryPublishedPosts,
  getDraftPostBySlug,
  getPublishedPostBySlug,
  getDraftPostById,
  writePosts,
  syncPublishedPosts,
  persistPosts,
  invalidatePostsCache,
};
