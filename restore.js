const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { ROOT_DIR, BACKUPS_DIR } = require('./lib/config');

function resolveBackupFile(input) {
  if (input) {
    return path.isAbsolute(input) ? input : path.join(ROOT_DIR, input);
  }

  if (!fs.existsSync(BACKUPS_DIR)) {
    throw new Error('No backups directory found.');
  }

  const files = fs.readdirSync(BACKUPS_DIR)
    .filter((name) => /^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/.test(name))
    .sort()
    .reverse();

  if (!files.length) throw new Error('No backup zip files found.');
  return path.join(BACKUPS_DIR, files[0]);
}

function runRestore() {
  const requestedPath = process.argv[2] || '';
  const backupFile = resolveBackupFile(requestedPath);
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  const zip = new AdmZip(backupFile);
  zip.extractAllTo(ROOT_DIR, true);

  // eslint-disable-next-line no-console
  console.log(`Restore completed from: ${backupFile}`);
}

try {
  runRestore();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(`Restore failed: ${error.message}`);
  process.exit(1);
}
