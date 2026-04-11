/**
 * settingsStore.js
 * Persists global UI/admin settings to data/settings.json.
 * Currently manages: ui_scale (global font-size multiplier, 0.85–1.15)
 */
const { createJsonFileStore } = require('./jsonFileStore');
const { DATA_DIR } = require('./config');
const path = require('path');
const logger = require('./logger');

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const UI_SCALE_MIN = 0.70;
const UI_SCALE_MAX = 1.15;
const UI_SCALE_DEFAULT = 1.0;

const DEFAULT_SETTINGS = {
  ui_scale: UI_SCALE_DEFAULT,
};

function normalizeSettings(value) {
  const base = value && typeof value === 'object' ? { ...value } : {};
  // Clamp and validate ui_scale
  const raw = parseFloat(base.ui_scale);
  base.ui_scale = !isNaN(raw)
    ? Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, raw))
    : UI_SCALE_DEFAULT;
  return base;
}

const settingsStore = createJsonFileStore({
  filePath: SETTINGS_FILE,
  fallbackValue: () => ({ ...DEFAULT_SETTINGS }),
  normalize: normalizeSettings,
});

async function readSettings() {
  return settingsStore.read();
}

async function getUiScale() {
  const settings = await readSettings();
  return settings.ui_scale;
}

async function setUiScale(scale) {
  const raw = parseFloat(scale);
  if (isNaN(raw)) throw new Error('ui_scale must be a number');
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, raw));
  // Round to 2 decimal places to avoid floating point noise
  const rounded = Math.round(clamped * 100) / 100;
  await settingsStore.update((current) => {
    const next = current && typeof current === 'object' ? { ...current } : {};
    next.ui_scale = rounded;
    return next;
  });
  logger.info('UI scale updated', { ui_scale: rounded });
  return rounded;
}

function invalidateSettingsCache() {
  settingsStore.invalidate();
}

module.exports = {
  readSettings,
  getUiScale,
  setUiScale,
  invalidateSettingsCache,
  UI_SCALE_MIN,
  UI_SCALE_MAX,
  UI_SCALE_DEFAULT,
};
