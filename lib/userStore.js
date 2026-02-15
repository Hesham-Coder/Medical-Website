const fs = require('fs').promises;
const bcrypt = require('bcrypt');
const { USERS_FILE } = require('./config');
const logger = require('./logger');

async function readUsers() {
  let raw = '';
  try {
    raw = await fs.readFile(USERS_FILE, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      logger.warn('Users file missing', { file: USERS_FILE });
      return {};
    }
    throw err;
  }

  let users;
  try {
    users = JSON.parse(raw || '{}');
  } catch (err) {
    logger.error('Users file invalid JSON', { file: USERS_FILE, error: err.message });
    const e = new Error('Users store unavailable');
    e.code = 'EUSERSTORE';
    throw e;
  }
  if (!users || typeof users !== 'object') {
    const e = new Error('Users store unavailable');
    e.code = 'EUSERSTORE';
    throw e;
  }
  return users;
}

async function writeUsers(users) {
  const tmp = USERS_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), 'utf8');
  await fs.rename(tmp, USERS_FILE);
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
    const users = await readUsers();
    const entry = findUserEntry(users, username);
    if (!entry) return;
    users[entry.key].lastLoginAt = dateIso || new Date().toISOString();
    await writeUsers(users);
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

  const users = await readUsers();
  const oldEntry = findUserEntry(users, currentUsername);
  if (!oldEntry) {
    return { status: 404, error: 'Account not found' };
  }
  const oldKey = oldEntry.key;
  const oldUser = oldEntry.record;

  const passwordMatch = await bcrypt.compare(String(currentPassword || ''), String(oldUser.password || ''));
  if (!passwordMatch) {
    return { status: 401, error: 'Current password is incorrect' };
  }

  const normalizedUsername = String(newUsername || oldKey).trim();
  if (!normalizedUsername) {
    return { status: 400, error: 'Username is required' };
  }

  const nextPasswordHash = newPassword
    ? await bcrypt.hash(newPassword, 12)
    : oldUser.password;

  const existingEntry = findUserEntry(users, normalizedUsername);
  const existingUsernameConflict = existingEntry && existingEntry.key !== oldKey;
  if (existingUsernameConflict) {
    return { status: 409, error: 'Username is already in use' };
  }

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
  await writeUsers(users);

  return {
    status: 200,
    user: sanitizePublicUser(updatedUser),
    usernameChanged: normalizedUsername !== oldKey,
  };
}

module.exports = {
  readUsers,
  writeUsers,
  sanitizePublicUser,
  getUserByUsername,
  updateLastLogin,
  updateCredentials,
};
