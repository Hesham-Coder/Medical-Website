const fs = require('fs').promises;

const DEFAULT_STAT_TTL_MS = 750;

function cloneValue(value) {
  if (value == null || typeof value !== 'object') {
    return value;
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function createWeakEtag(state) {
  const mtime = state && state.mtimeMs ? Math.trunc(state.mtimeMs) : 0;
  const size = state && typeof state.size === 'number' ? state.size : Buffer.byteLength(state && state.serialized ? state.serialized : '', 'utf8');
  return `W/"${size}-${mtime}"`;
}

function createJsonFileStore(options) {
  const {
    filePath,
    fallbackValue,
    normalize = (value) => value,
    serialize = (value) => JSON.stringify(value, null, 2),
    statTtlMs = DEFAULT_STAT_TTL_MS,
    cloneOnRead = true,
  } = options || {};

  if (!filePath) {
    throw new Error('createJsonFileStore requires a filePath');
  }

  let cache = null;
  let writeChain = Promise.resolve();

  function resolveFallback() {
    return typeof fallbackValue === 'function' ? fallbackValue() : fallbackValue;
  }

  async function readFileText() {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return serialize(normalize(resolveFallback()));
      }
      throw error;
    }
  }

  async function readStat() {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async function loadFromDisk() {
    const [raw, stat] = await Promise.all([readFileText(), readStat()]);
    const parsed = JSON.parse(raw);
    const normalized = normalize(parsed);
    const serialized = serialize(normalized);

    cache = {
      data: normalized,
      serialized,
      mtimeMs: stat ? stat.mtimeMs : 0,
      size: stat ? stat.size : Buffer.byteLength(serialized, 'utf8'),
      checkedAt: Date.now(),
    };

    return cache;
  }

  async function ensureFreshState() {
    const now = Date.now();
    if (cache && now - cache.checkedAt < statTtlMs) {
      return cache;
    }

    if (!cache) {
      return loadFromDisk();
    }

    const stat = await readStat();
    cache.checkedAt = now;

    if (
      stat &&
      stat.mtimeMs === cache.mtimeMs &&
      stat.size === cache.size
    ) {
      return cache;
    }

    if (!stat && cache.mtimeMs === 0) {
      return cache;
    }

    return loadFromDisk();
  }

  async function writeUnsafe(nextValue, writeOptions) {
    const normalized = normalize(nextValue);
    const serialized = serialize(normalized);
    const tmpPath = `${filePath}.tmp`;

    if (writeOptions && typeof writeOptions.beforeWrite === 'function') {
      await writeOptions.beforeWrite();
    }

    await fs.writeFile(tmpPath, serialized, 'utf8');
    await fs.rename(tmpPath, filePath);

    const stat = await readStat();
    cache = {
      data: normalized,
      serialized,
      mtimeMs: stat ? stat.mtimeMs : Date.now(),
      size: stat ? stat.size : Buffer.byteLength(serialized, 'utf8'),
      checkedAt: Date.now(),
    };

    return normalized;
  }

  function enqueueWrite(task) {
    const next = writeChain.then(task, task);
    writeChain = next.catch(() => {});
    return next;
  }

  async function getSnapshot(readOptions) {
    const state = await ensureFreshState();
    return {
      data: readOptions && readOptions.clone === false ? state.data : cloneValue(state.data),
      metadata: {
        etag: createWeakEtag(state),
        lastModified: state.mtimeMs ? new Date(state.mtimeMs).toUTCString() : null,
        mtimeMs: state.mtimeMs,
        size: state.size,
      },
    };
  }

  async function read(readOptions) {
    const snapshot = await getSnapshot({
      clone: readOptions && Object.prototype.hasOwnProperty.call(readOptions, 'clone')
        ? readOptions.clone
        : cloneOnRead,
    });
    return snapshot.data;
  }

  async function write(nextValue, writeOptions) {
    return enqueueWrite(() => writeUnsafe(nextValue, writeOptions));
  }

  async function update(mutator, writeOptions) {
    return enqueueWrite(async () => {
      const current = await ensureFreshState();
      const draft = cloneValue(current.data);
      const nextValue = await mutator(draft);
      return writeUnsafe(nextValue === undefined ? draft : nextValue, writeOptions);
    });
  }

  function invalidate() {
    cache = null;
  }

  return {
    read,
    write,
    update,
    getSnapshot,
    invalidate,
  };
}

module.exports = {
  createJsonFileStore,
  cloneValue,
};
