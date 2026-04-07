const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const logger = require('./logger');
const fsp = fs.promises;
const {
  ROOT_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  BACKUPS_DIR,
  USERS_FILE,
  CONTACTS_FILE,
  CONTENT_FILE,
  PUBLISHED_CONTENT_FILE,
} = require('./config');

function stamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-');
}

async function ensureDir(dir) {
  try {
    await fsp.mkdir(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${units[index]}`;
}

function addFileIfExists(zip, filePath, zipPath) {
  try {
    if (fs.existsSync(filePath)) {
      zip.addFile(path.basename(filePath), fs.readFileSync(filePath));
      return true;
    }
  } catch (error) {
    logger.warn('Failed to add file to backup', { file: filePath, error: error.message });
  }
  return false;
}

function addFolderIfExists(zip, folderPath, zipFolderName) {
  try {
    if (fs.existsSync(folderPath)) {
      zip.addLocalFolder(folderPath, zipFolderName);
      return true;
    }
  } catch (error) {
    logger.warn('Failed to add folder to backup', { folder: folderPath, error: error.message });
  }
  return false;
}

async function createBackup() {
  try {
    await ensureDir(BACKUPS_DIR);

    const zip = new AdmZip();
    const metadata = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      files: {},
    };

    // Backup all data files
    const dataFiles = [
      { path: USERS_FILE, name: 'users.json', label: 'Users' },
      { path: CONTACTS_FILE, name: 'contacts.json', label: 'Contact Submissions' },
      { path: CONTENT_FILE, name: 'content.json', label: 'Draft Content' },
      { path: PUBLISHED_CONTENT_FILE, name: 'published-content.json', label: 'Published Content' },
    ];

    for (const file of dataFiles) {
      try {
        if (fs.existsSync(file.path)) {
          const content = await fsp.readFile(file.path, 'utf8');
          zip.addFile(file.name, Buffer.from(content));
          metadata.files[file.label] = { file: file.name, size: content.length, backed: true };
        }
      } catch (error) {
        logger.warn('Failed to backup data file', { file: file.path, error: error.message });
        metadata.files[file.label] = { file: file.name, backed: false, error: error.message };
      }
    }

    // Backup uploads directory
    try {
      if (fs.existsSync(UPLOADS_DIR)) {
        zip.addLocalFolder(UPLOADS_DIR, 'uploads');
        metadata.uploads = { backed: true };
      }
    } catch (error) {
      logger.warn('Failed to backup uploads', { error: error.message });
      metadata.uploads = { backed: false, error: error.message };
    }

    // Add metadata file
    zip.addFile('backup-metadata.json', Buffer.from(JSON.stringify(metadata, null, 2)));

    // Write backup zip
    const filename = `backup-${stamp()}.zip`;
    const outFile = path.join(BACKUPS_DIR, filename);
    zip.writeZip(outFile);

    logger.info('Backup created successfully', {
      filename,
      path: outFile,
      metadata,
    });

    return {
      success: true,
      filename,
      path: outFile,
      metadata,
      message: 'All website content, data, and uploads backed up successfully.',
    };
  } catch (error) {
    logger.error('Backup creation failed', { error: error.message });
    throw error;
  }
}

async function restoreBackup(backupPath) {
  try {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    const zip = new AdmZip(backupPath);
    const entries = zip.getEntries();
    const metadata = {
      restored: {},
      errors: [],
    };

    // Create temporary extract directory
    const tempDir = path.join(BACKUPS_DIR, `.restore-${Date.now()}`);
    await ensureDir(tempDir);

    try {
      // Extract all to temp directory first
      zip.extractAllTo(tempDir, true);

      // Restore data files
      const dataFiles = [
        { restored: 'users.json', target: USERS_FILE, label: 'Users' },
        { restored: 'contacts.json', target: CONTACTS_FILE, label: 'Contact Submissions' },
        { restored: 'content.json', target: CONTENT_FILE, label: 'Draft Content' },
        { restored: 'published-content.json', target: PUBLISHED_CONTENT_FILE, label: 'Published Content' },
      ];

      for (const file of dataFiles) {
        try {
          const tempFile = path.join(tempDir, file.restored);
          if (fs.existsSync(tempFile)) {
            const content = await fsp.readFile(tempFile, 'utf8');
            await ensureDir(path.dirname(file.target));
            await fsp.writeFile(file.target, content, 'utf8');
            metadata.restored[file.label] = { success: true, file: file.restored };
          }
        } catch (error) {
          logger.warn('Failed to restore data file', { file: file.restored, error: error.message });
          metadata.errors.push({ file: file.label, error: error.message });
        }
      }

      // Restore uploads
      try {
        const tempUploads = path.join(tempDir, 'uploads');
        if (fs.existsSync(tempUploads)) {
          await ensureDir(UPLOADS_DIR);
          const files = await fsp.readdir(tempUploads);
          for (const file of files) {
            const src = path.join(tempUploads, file);
            const dest = path.join(UPLOADS_DIR, file);
            const stat = await fsp.stat(src);
            if (stat.isFile()) {
              const content = await fsp.readFile(src);
              await fsp.writeFile(dest, content);
            }
          }
          metadata.restored['Uploads'] = { success: true, files: files.length };
        }
      } catch (error) {
        logger.warn('Failed to restore uploads', { error: error.message });
        metadata.errors.push({ category: 'Uploads', error: error.message });
      }

      logger.info('Backup restored successfully', { backupPath, metadata });

      return {
        success: true,
        message: 'All website content and uploads restored successfully.',
        metadata,
      };
    } finally {
      // Cleanup temp directory
      try {
        await fsp.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        logger.warn('Failed to cleanup temp directory', { path: tempDir, error: error.message });
      }
    }
  } catch (error) {
    logger.error('Backup restore failed', { error: error.message });
    throw error;
  }
}

async function listBackups() {
  try {
    await ensureDir(BACKUPS_DIR);
    const files = await fsp.readdir(BACKUPS_DIR);
    const backups = [];

    for (const file of files) {
      if (/^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/.test(file)) {
        const filePath = path.join(BACKUPS_DIR, file);
        const stat = await fsp.stat(filePath);
        backups.push({
          filename: file,
          size: stat.size,
          sizeReadable: formatBytes(stat.size),
          timestamp: stat.mtime.toISOString(),
        });
      }
    }

    return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    logger.error('Failed to list backups', { error: error.message });
    return [];
  }
}

module.exports = {
  createBackup,
  restoreBackup,
  listBackups,
};
