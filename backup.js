const { createBackup } = require('./lib/backupStore');

(async () => {
  try {
    const result = await createBackup();
    // eslint-disable-next-line no-console
    console.log('Backup created successfully');
    // eslint-disable-next-line no-console
    console.log(`File: ${result.filename}`);
    // eslint-disable-next-line no-console
    console.log(`Path: ${result.path}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Backup failed:', error.message);
    process.exit(1);
  }
})();
