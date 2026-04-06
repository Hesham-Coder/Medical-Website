const bcrypt = require('bcrypt');
const { USERS_FILE } = require('./config');
const logger = require('./logger');
const { createJsonFileStore } = require('./jsonFileStore');

function normalizeUsers(users) {
  return users && typeof users === 'object' && !Array.isArray(users) ? { ...users } : {};
}

const usersStore = createJsonFileStore({
  filePath: USERS_FILE,
  fallbackValue: () => ({}),
  normalize: normalizeUsers,
});

async function readUsers() {
  try {
    return await usersStore.read();
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      logger.warn('Users file missing', { file: USERS_FILE });
      return {};
    }
    if (err instanceof SyntaxError) {
      logger.error('Users file invalid JSON', { file: USERS_FILE, error: err.message });
      const error = new Error('Users store unavailable');
      error.code = 'EUSERSTORE';
      throw error;
    }
    throw err;
  }
}

async function writeUsers(users) {
  await usersStore.write(users);
}

function sanitizePublicUser(record) {
  if (!record || typeof record !== 'object') return null;
  return {
    username: String(record.username || ''),
    email: String(record.email || ''),
    createdAt: record.createdAt || null,
    lastLoginAt: record.lastLoginAt || null,
  };
}

function findUserEntry(users, username) {
  const target = String(username || '').trim();
  if (!target) return null;

  if (users[target]) {
    return { key: target, record: users[target] };
  }

  const matchedKey = Object.keys(users).find((key) => {
    const row = users[key];
    if (!row || typeof row !== 'object') return false;
    return String(row.username || '').trim() === target;
  });

  if (!matchedKey) return null;
  return { key: matchedKey, record: users[matchedKey] };
}

async function getUserByUsername(username) {
  const users = await readUsers();
  return findUserEntry(users, username);
}

async function updateLastLogin(username, dateIso) {
  try {
    await usersStore.update((users) => {
      const entry = findUserEntry(users, username);
      if (!entry) return users;
      users[entry.key].lastLoginAt = dateIso || new Date().toISOString();
      return users;
    });
  } catch (err) {
    logger.error('Failed to update last login', { error: err.message });
  }
}

async function updateCredentials(params) {
  const {
    currentUsername,
    currentPassword,
    newUsername,
    newPassword,
  } = params;

  let result = { status: 500, error: 'Unable to update credentials' };

  await usersStore.update(async (users) => {
    const oldEntry = findUserEntry(users, currentUsername);
    if (!oldEntry) {
      result = { status: 404, error: 'Account not found' };
      return users;
    }

    const oldKey = oldEntry.key;
    const oldUser = oldEntry.record;
    const passwordMatch = await bcrypt.compare(String(currentPassword || ''), String(oldUser.password || ''));
    if (!passwordMatch) {
      result = { status: 401, error: 'Current password is incorrect' };
      return users;
    }

    const normalizedUsername = String(newUsername || oldKey).trim();
    if (!normalizedUsername) {
      result = { status: 400, error: 'Username is required' };
      return users;
    }

    const existingEntry = findUserEntry(users, normalizedUsername);
    const existingUsernameConflict = existingEntry && existingEntry.key !== oldKey;
    if (existingUsernameConflict) {
      result = { status: 409, error: 'Username is already in use' };
      return users;
    }

    const nextPasswordHash = newPassword
      ? await bcrypt.hash(newPassword, 12)
      : oldUser.password;

    const updatedUser = {
      ...oldUser,
      username: normalizedUsername,
      password: nextPasswordHash,
      updatedAt: new Date().toISOString(),
      createdAt: oldUser.createdAt || new Date().toISOString(),
      lastLoginAt: oldUser.lastLoginAt || null,
    };

    if (normalizedUsername !== oldKey) {
      delete users[oldKey];
    }

    users[normalizedUsername] = updatedUser;
    result = {
      status: 200,
      user: sanitizePublicUser(updatedUser),
      usernameChanged: normalizedUsername !== oldKey,
    };

    return users;
  });

  return result;
}

function invalidateUsersCache() {
  usersStore.invalidate();
}

module.exports = {
  readUsers,
  writeUsers,
  sanitizePublicUser,
  getUserByUsername,
  updateLastLogin,
  updateCredentials,
  invalidateUsersCache,
};
