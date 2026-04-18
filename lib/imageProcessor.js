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

/**
 * Process an uploaded image into three variants:
 *   - A JPEG copy  (.jpg)  — guaranteed JPEG binary for social media OG images
 *   - A WebP copy  (.webp) — modern browsers & performance
 *   - An AVIF copy (.avif) — next-gen compression
 *
 * The JPEG variant is always produced from the original source so that
 * og:image / twitter:image URLs served with a .jpg extension are genuinely
 * JPEG content, regardless of what format the user uploaded.
 */
async function processUploadedImage(file) {
  const sourcePath = file && file.path ? String(file.path) : '';
  if (!sourcePath) {
    throw new Error('Uploaded image path is required');
  }

  const parsed = path.parse(sourcePath);
  const baseName = parsed.name;

  const jpgFilename  = baseName + '.jpg';
  const webpFilename = baseName + '.webp';
  const avifFilename = baseName + '.avif';

  const jpgPath  = path.join(UPLOADS_DIR, jpgFilename);
  const webpPath = path.join(UPLOADS_DIR, webpFilename);
  const avifPath = path.join(UPLOADS_DIR, avifFilename);

  try {
    await Promise.all([
      // JPEG: always written so og:image Content-Type is guaranteed image/jpeg
      writeVariant(sourcePath, jpgPath, 'jpeg', { quality: 88, mozjpeg: true }),
      writeVariant(sourcePath, webpPath, 'webp', { quality: 82, effort: 4 }),
      writeVariant(sourcePath, avifPath, 'avif', { quality: 60, effort: 4 }),
    ]);

    return {
      originalUrl: '/uploads/' + path.basename(sourcePath),
      jpgUrl:      '/uploads/' + jpgFilename,
      webpUrl:     '/uploads/' + webpFilename,
      avifUrl:     '/uploads/' + avifFilename,
    };
  } catch (error) {
    await Promise.allSettled([
      fs.unlink(jpgPath),
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
