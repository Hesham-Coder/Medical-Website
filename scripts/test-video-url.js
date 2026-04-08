/**
 * Video URL validation & transform tests.
 * Run with:  node scripts/test-video-url.js
 */

'use strict';

// ─── Helpers (mirrors what dashboard.html and website/mobile.html do) ─────────

function toEmbedUrl(raw) {
  raw = String(raw || '').trim();
  if (!raw) return '';

  if (/youtube\.com\/watch\?v=/i.test(raw)) {
    const id = (raw.split('v=')[1] || '').split('&')[0];
    return id ? 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0' : '';
  }
  if (/youtu\.be\//i.test(raw)) {
    const sid = (raw.split('youtu.be/')[1] || '').split(/[?&]/)[0];
    return sid ? 'https://www.youtube-nocookie.com/embed/' + sid + '?rel=0' : '';
  }
  if (/vimeo\.com\/\d+/i.test(raw)) {
    const vmId = (raw.match(/vimeo\.com\/(\d+)/i) || [])[1];
    return vmId ? 'https://player.vimeo.com/video/' + vmId : '';
  }
  if (
    /youtube\.com\/embed\//i.test(raw) ||
    /youtube-nocookie\.com\/embed\//i.test(raw) ||
    /player\.vimeo\.com\/video\//i.test(raw) ||
    /facebook\.com\/plugins\/video\.php/i.test(raw)
  ) {
    return raw;
  }
  if (/facebook\.com\//i.test(raw)) {
    return 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(raw) + '&show_text=false';
  }
  return '';
}

function isDirectFileUrl(url) {
  return /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i.test(String(url || '')) ||
         String(url || '').startsWith('/uploads/');
}

// ─── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(description, actual, expected) {
  if (actual === expected) {
    console.log('  ✓', description);
    passed++;
  } else {
    console.error('  ✗', description);
    console.error('    expected:', expected);
    console.error('    actual  :', actual);
    failed++;
  }
}

function section(name) {
  console.log('\n' + name);
}

// ─── YouTube URL transform ─────────────────────────────────────────────────────

section('YouTube watch URL → embed');
assert(
  'Standard watch URL',
  toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
);
assert(
  'Watch URL with extra params',
  toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PL123'),
  'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
);

section('YouTube short URL → embed');
assert(
  'youtu.be short link',
  toEmbedUrl('https://youtu.be/dQw4w9WgXcQ'),
  'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
);
assert(
  'youtu.be with query',
  toEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=15'),
  'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
);

section('Already-embedded YouTube URL → pass-through');
assert(
  'youtube.com/embed pass-through',
  toEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'),
  'https://www.youtube.com/embed/dQw4w9WgXcQ'
);
assert(
  'youtube-nocookie.com/embed pass-through',
  toEmbedUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'),
  'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
);

section('Vimeo URL → embed');
assert(
  'Vimeo canonical URL',
  toEmbedUrl('https://vimeo.com/123456789'),
  'https://player.vimeo.com/video/123456789'
);
assert(
  'Vimeo player pass-through',
  toEmbedUrl('https://player.vimeo.com/video/123456789'),
  'https://player.vimeo.com/video/123456789'
);

section('Facebook video URL → embed');
const fbRaw = 'https://www.facebook.com/watch/?v=123456789';
const fbExpected = 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(fbRaw) + '&show_text=false';
assert('Facebook watch URL → plugin embed', toEmbedUrl(fbRaw), fbExpected);

section('Facebook plugin URL → pass-through');
const fbPlugin = 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F%3Fv%3D123&show_text=false';
assert('Facebook plugin URL pass-through', toEmbedUrl(fbPlugin), fbPlugin);

section('Invalid / unrecognised URLs → empty string');
assert('Plain HTTP URL', toEmbedUrl('https://example.com/video'), '');
assert('Empty string', toEmbedUrl(''), '');
assert('Null-ish', toEmbedUrl(null), '');
assert('Random text', toEmbedUrl('not a url'), '');

section('Direct file URL detection');
assert('MP4 file', isDirectFileUrl('/uploads/vid-123.mp4'), true);
assert('WebM file', isDirectFileUrl('/uploads/vid-abc.webm'), true);
assert('MOV file', isDirectFileUrl('https://cdn.example.com/video.mov'), true);
assert('Uploads path', isDirectFileUrl('/uploads/vid-123-abc.mp4'), true);
assert('YouTube URL is NOT direct file', isDirectFileUrl('https://www.youtube.com/watch?v=xyz'), false);
assert('Empty is NOT direct file', isDirectFileUrl(''), false);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);

if (failed > 0) {
  process.exitCode = 1;
}
