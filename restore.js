const path = require('path');
const fs = require('fs');
const { restoreBackup } = require('./lib/backupStore');
const { BACKUPS_DIR, ROOT_DIR } = require('./lib/config');

function resolveBackupFile(input) {
  if (input) {
    return path.isAbsolute(input) ? input : path.join(ROOT_DIR, input);
  }

  if (!fs.existsSync(BACKUPS_DIR)) {
    throw new Error('No backups directory found.');
  }

  const files = fs.readdirSync(BACKUPS_DIR)
    .filter((name) => /^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/.test(name))
    .sort()
    .reverse();

  if (!files.length) throw new Error('No backup zip files found.');
  return path.join(BACKUPS_DIR, files[0]);
}

(async () => {
  try {
    const requestedPath = process.argv[2] || '';
    const backupFile = resolveBackupFile(requestedPath);
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    const result = await restoreBackup(backupFile);
    // eslint-disable-next-line no-console
    console.log('Restore completed successfully');
    // eslint-disable-next-line no-console
    console.log(`From: ${backupFile}`);
    if (result.metadata.errors && result.metadata.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Some warnings occurred:');
      result.metadata.errors.forEach((err) => {
        // eslint-disable-next-line no-console
        console.warn(`  - ${err.file || err.category}: ${err.error}`);
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Restore failed: ${error.message}`);
    process.exit(1);
  }
})();
