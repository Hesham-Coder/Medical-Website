/**
 * Database Adapter - Abstracts PostgreSQL/JSON file storage
 * Detects environment and uses appropriate backend
 */

const fs = require('fs').promises;
const path = require('path');
const { DATA_DIR, CONTENT_FILE, POSTS_FILE, USERS_FILE, CONTACTS_FILE } = require('./config');

const DATABASE_TYPE = process.env.POSTGRES_URL ? 'postgresql' : 'json';
let pgPool = null;

if (DATABASE_TYPE === 'postgresql') {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.POSTGRES_URL,
  });
}

const db = {};

// ============ JSON FILE STORAGE (Railway/Local) ============
if (DATABASE_TYPE === 'json') {
  db.readJSON = async (filepath) => {
    try {
      const data = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  };

  db.writeJSON = async (filepath, data) => {
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
  };

  db.getContent = async () => db.readJSON(CONTENT_FILE) || {};
  db.setContent = async (data) => db.writeJSON(CONTENT_FILE, data);
  db.getPosts = async () => db.readJSON(POSTS_FILE) || [];
  db.setPosts = async (data) => db.writeJSON(POSTS_FILE, data);
  db.getUsers = async () => db.readJSON(USERS_FILE) || {};
  db.setUsers = async (data) => db.writeJSON(USERS_FILE, data);
  db.getContacts = async () => db.readJSON(CONTACTS_FILE) || [];
  db.setContacts = async (data) => db.writeJSON(CONTACTS_FILE, data);
}

// ============ PostgreSQL ============
else if (DATABASE_TYPE === 'postgresql') {
  // Initialize tables
  const initDB = async () => {
    const client = await pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_data (
          key VARCHAR(255) PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id VARCHAR(50) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          username VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS contacts (
          id VARCHAR(50) PRIMARY KEY,
          data JSONB NOT NULL,
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } finally {
      client.release();
    }
  };
  initDB().catch(console.error);

  db.getContent = async () => {
    const result = await pgPool.query('SELECT value FROM app_data WHERE key = $1', ['content']);
    return result.rows[0]?.value || {};
  };

  db.setContent = async (data) => {
    await pgPool.query(
      'INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
      ['content', JSON.stringify(data)]
    );
  };

  db.getPosts = async () => {
    const result = await pgPool.query('SELECT data FROM posts ORDER BY updated_at DESC');
    return result.rows.map(r => r.data);
  };

  db.setPosts = async (posts) => {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM posts');
      for (const post of posts) {
        await client.query(
          'INSERT INTO posts (id, data) VALUES ($1, $2)',
          [post.id, JSON.stringify(post)]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };

  db.getUsers = async () => {
    const result = await pgPool.query('SELECT data FROM users');
    const users = {};
    for (const row of result.rows) {
      users[row.data.username] = row.data;
    }
    return users;
  };

  db.setUsers = async (users) => {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM users');
      for (const [username, data] of Object.entries(users)) {
        await client.query(
          'INSERT INTO users (username, data) VALUES ($1, $2)',
          [username, JSON.stringify(data)]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };

  db.getContacts = async () => {
    const result = await pgPool.query('SELECT data FROM contacts ORDER BY submitted_at DESC');
    return result.rows.map(r => r.data);
  };

  db.setContacts = async (contacts) => {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM contacts');
      for (const contact of contacts) {
        await client.query(
          'INSERT INTO contacts (id, data) VALUES ($1, $2)',
          [contact.id, JSON.stringify(contact)]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };
}

module.exports = {
  ...db,
  getType: () => DATABASE_TYPE,
  pool: pgPool,
};
