/**
 * One-time migration: ensure every uploaded image has a genuine JPEG (.jpg) variant.
 *
 * Problem: Some images were uploaded before imageProcessor.js was updated to always
 * write a true JPEG. Their .jpg file may actually be WebP/AVIF content, causing
 * "Invalid Image Content Type" errors on Facebook, WhatsApp, LinkedIn og:image crawlers.
 *
 * This script re-processes all uploads in /uploads/ and writes guaranteed JPEG variants.
 *
 * Usage (run once on the server):
 *   node scripts/regenerate-jpg-variants.js
 *
 * Safe to run multiple times — it skips files that are already verified JPEG.
 */

'use strict';

const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Image extensions to process (not videos, not already-processed variants to skip)
const SOURCE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.avif'];

async function isGenuineJpeg(filePath) {
  try {
    const buf = Buffer.alloc(3);
    const fh = await fs.open(filePath, 'r');
    await fh.read(buf, 0, 3, 0);
    await fh.close();
    // JPEG magic bytes: FF D8 FF
    return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  } catch {
    return false;
  }
}

async function writeJpeg(sourcePath, targetPath) {
  await sharp(sourcePath)
    .rotate()
    .resize({
      width: 1200,
      height: 1200,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(targetPath);
}

async function run() {
  console.log(`\n📁 Scanning uploads directory: ${UPLOADS_DIR}\n`);

  let files;
  try {
    files = await fs.readdir(UPLOADS_DIR);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`ℹ️ Uploads directory not found at ${UPLOADS_DIR}. Skipping regeneration.`);
      process.exit(0);
    }
    console.error(`❌ Cannot read uploads directory: ${err.message}`);
    process.exit(1);
  }

  const imageFiles = files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return SOURCE_EXTENSIONS.includes(ext) && !f.startsWith('.');
  });

  console.log(`Found ${imageFiles.length} image file(s) to check.\n`);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const filename of imageFiles) {
    const filePath = path.join(UPLOADS_DIR, filename);
    const parsed = path.parse(filename);
    const jpgFilename = parsed.name + '.jpg';
    const jpgPath = path.join(UPLOADS_DIR, jpgFilename);

    // If the target is already a genuine JPEG, skip
    let alreadyGoodJpeg = false;
    try {
      await fs.access(jpgPath);
      alreadyGoodJpeg = await isGenuineJpeg(jpgPath);
    } catch {
      alreadyGoodJpeg = false;
    }

    if (alreadyGoodJpeg) {
      console.log(`  ✅ SKIP  ${jpgFilename}  (already a valid JPEG)`);
      skipped++;
      continue;
    }

    try {
      await writeJpeg(filePath, jpgPath);
      console.log(`  🔄 FIXED ${filename} → ${jpgFilename}`);
      fixed++;
    } catch (err) {
      console.error(`  ❌ ERROR ${filename}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Fixed  : ${fixed}`);
  console.log(`⏭  Skipped: ${skipped}`);
  console.log(`❌ Errors : ${errors}`);
  console.log(`\nDone. Restart the server if you updated the SEO image.`);
  console.log(`\nThen re-scrape your URL on Facebook Debugger:`);
  console.log(`  https://developers.facebook.com/tools/debug/\n`);
}

run();
