const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const {
  ROOT_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  BACKUPS_DIR,
} = require('./lib/config');

function stamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('-');
}

function addFolderIfExists(zip, folderPath, zipFolderName) {
  if (!fs.existsSync(folderPath)) return;
  zip.addLocalFolder(folderPath, zipFolderName);
}

function runBackup() {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const zip = new AdmZip();

  addFolderIfExists(zip, DATA_DIR, 'data');
  addFolderIfExists(zip, UPLOADS_DIR, 'uploads');

  const filename = `backup-${stamp()}.zip`;
  const outFile = path.join(BACKUPS_DIR, filename);
  zip.writeZip(outFile);

  // eslint-disable-next-line no-console
  console.log(`Backup created: ${outFile}`);
}

runBackup();
