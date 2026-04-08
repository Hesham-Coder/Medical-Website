const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const postcss = require('postcss');
const tailwindcss = require('@tailwindcss/postcss');
const autoprefixer = require('autoprefixer');

const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const INPUT_CSS = path.join(WEBSITE_DIR, 'src', 'tailwind.css');
const OUTPUT_CSS = path.join(WEBSITE_DIR, 'css', 'tailwind.output.css');

function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

async function buildTailwind() {
  const input = await fs.readFile(INPUT_CSS, 'utf8');
  const result = await postcss([tailwindcss(), autoprefixer]).process(input, {
    from: INPUT_CSS,
    to: OUTPUT_CSS,
  });

  await fs.mkdir(path.dirname(OUTPUT_CSS), { recursive: true });
  await fs.writeFile(OUTPUT_CSS, result.css, 'utf8');
  return hashContent(result.css);
}

function versionAssetMarkup(html, assetPath, version) {
  const escapedPath = assetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(["'])${escapedPath}(?:\\?v=[a-f0-9]{8})?\\1`, 'g');
  return html.replace(pattern, (match, quote) => `${quote}${assetPath}?v=${version}${quote}`);
}

async function collectHtmlFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectHtmlFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function updateHtmlVersions() {
  const htmlFiles = await collectHtmlFiles(WEBSITE_DIR);
  const assetVersionMap = new Map();

  for (const htmlFile of htmlFiles) {
    let html = await fs.readFile(htmlFile, 'utf8');
    const assetMatches = [...html.matchAll(/<(?:link|script)[^>]+(?:href|src)=\"(\/(?:css|js)\/[^\"?#]+)(?:\?v=[^\"]*)?\"/g)];

    for (const [, assetPath] of assetMatches) {
      if (!assetVersionMap.has(assetPath)) {
        const diskPath = path.join(WEBSITE_DIR, assetPath.replace(/^\//, ''));
        const content = await fs.readFile(diskPath);
        assetVersionMap.set(assetPath, hashContent(content));
      }
      html = versionAssetMarkup(html, assetPath, assetVersionMap.get(assetPath));
    }

    await fs.writeFile(htmlFile, html, 'utf8');
  }
}

async function main() {
  const tailwindVersion = await buildTailwind();
  await updateHtmlVersions();
  console.log(`Built tailwind.output.css?v=${tailwindVersion}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
