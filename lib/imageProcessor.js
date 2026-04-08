const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const logger = require('./logger');
const { UPLOADS_DIR } = require('./config');

async function writeVariant(sourcePath, targetPath, format, options) {
  await sharp(sourcePath)
    .rotate()
    .resize({
      width: 1200,
      height: 1200,
      fit: 'inside',
      withoutEnlargement: true,
    })
    [format](options)
    .toFile(targetPath);
}

async function processUploadedImage(file) {
  const sourcePath = file && file.path ? String(file.path) : '';
  if (!sourcePath) {
    throw new Error('Uploaded image path is required');
  }

  const parsed = path.parse(sourcePath);
  const webpFilename = parsed.name + '.webp';
  const avifFilename = parsed.name + '.avif';
  const webpPath = path.join(UPLOADS_DIR, webpFilename);
  const avifPath = path.join(UPLOADS_DIR, avifFilename);

  try {
    await Promise.all([
      writeVariant(sourcePath, webpPath, 'webp', { quality: 82, effort: 4 }),
      writeVariant(sourcePath, avifPath, 'avif', { quality: 60, effort: 4 }),
    ]);

    return {
      originalUrl: '/uploads/' + path.basename(sourcePath),
      webpUrl: '/uploads/' + webpFilename,
      avifUrl: '/uploads/' + avifFilename,
    };
  } catch (error) {
    await Promise.allSettled([
      fs.unlink(webpPath),
      fs.unlink(avifPath),
    ]);

    logger.error('Image post-processing failed', {
      error: error.message,
      sourcePath: path.basename(sourcePath),
    });
    throw error;
  }
}

module.exports = {
  processUploadedImage,
};
