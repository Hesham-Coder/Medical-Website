/**
 * Language & Direction Helper
 * Handles RTL/LTR direction management for bilingual Arabic/English support
 * 
 * Key Concepts:
 * - Direction is controlled ONLY at <html> root element
 * - Numbers are wrapped with directional markers to keep them LTR in RTL context
 * - Language preference is persisted to localStorage
 * - All DOM updates respect direction changes
 */

const VALID_LANGS = ['en', 'ar'];
const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'app-lang-preference';

/**
 * Get the ISO 639-1 language code from browser
 * Falls back to English if detection fails
 */
function detectBrowserLanguage() {
  const browserLang = (navigator.language || navigator.userLanguage || '').split('-')[0];
  return VALID_LANGS.includes(browserLang) ? browserLang : DEFAULT_LANG;
}

/**
 * Initialize language system on page load
 * Restores saved preference or detects browser language
 */
function initializeLanguage() {
  let lang = localStorage.getItem(STORAGE_KEY);

  if (!lang || !VALID_LANGS.includes(lang)) {
    // Bridge: fall back to website 'lang' key so admin pages honour the
    // language a user already selected on the public website.
    const websiteLang = localStorage.getItem('lang');
    lang = (websiteLang && VALID_LANGS.includes(websiteLang))
      ? websiteLang
      : detectBrowserLanguage();
  }
  
  setLanguage(lang);
  return lang;
}

/**
 * SET language and update HTML element accordingly
 * This is the SINGLE SOURCE OF TRUTH for direction changes
 * 
 * @param {string} lang - 'en' or 'ar'
 */
function setLanguage(lang) {
  if (!VALID_LANGS.includes(lang)) {
    console.warn(`Invalid language "${lang}". Using "${DEFAULT_LANG}".`);
    lang = DEFAULT_LANG;
  }
  
  // Update HTML element - this cascades to entire document
  const html = document.documentElement;
  html.setAttribute('lang', lang);
  html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  
  // Save preference
  localStorage.setItem(STORAGE_KEY, lang);
  
  // Trigger custom event for other components to listen
  document.dispatchEvent(
    new CustomEvent('languageChanged', { 
      detail: { lang, dir: html.getAttribute('dir') } 
    })
  );
}

/**
 * GET current language
 */
function getCurrentLanguage() {
  return document.documentElement.getAttribute('lang') || DEFAULT_LANG;
}

/**
 * GET current direction
 */
function getCurrentDirection() {
  return document.documentElement.getAttribute('dir') || 'ltr';
}

/**
 * Check if current language is RTL (Arabic)
 */
function isRTL() {
  return getCurrentDirection() === 'rtl';
}

/**
 * Wrap numbers with LTR markers for safe rendering in RTL context
 * Solves the issue of numbers getting flipped in Arabic text
 * 
 * Uses Unicode directional markers:
 * - LRE (U+202A): Left-to-Right Embedding
 * - PDF (U+202C): Pop Directional Formatting
 * 
 * @param {string} text - Text potentially containing numbers
 * @returns {string} Text with numbers wrapped in directional markers
 */
function wrapNumbersForRTL(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Pattern matches: whole numbers, decimals, phone numbers, percentages
  // Examples: 123, 45.67, +1-234-567-8900, 50%
  const numberPattern = /(\d+(?:[,.\s]\d+)*%?|\+\d+[-.\s\d]+)/g;
  
  return text.replace(numberPattern, (match) => {
    // LRE (U+202A) + number + PDF (U+202C)
    return '\u202A' + match + '\u202C';
  });
}

/**
 * Safe wrapper for dynamic content with numbers
 * Use this when setting innerHTML or textContent with dynamic data
 * 
 * @param {HTMLElement} element - DOM element to update
 * @param {string} text - Content text (plain text, will auto-escape)
 * @param {boolean} preserveHTML - If true, treats text as safe HTML (be careful!)
 */
function setDirectionalText(element, text, preserveHTML = false) {
  if (!element || typeof text !== 'string') return;
  
  // Wrap numbers with directional markers if in RTL
  const processedText = isRTL() ? wrapNumbersForRTL(text) : text;
  
  if (preserveHTML) {
    element.innerHTML = processedText;
  } else {
    element.textContent = processedText;
    // If there are numbers, we need to use innerHTML to insert the markers
    if (isRTL() && /\d+/.test(text)) {
      element.innerHTML = processedText;
    }
  }
}

/**
 * Create a language switcher control
 * Returns HTML string for a simple language switcher button/dropdown
 * 
 * @returns {string} HTML for language switcher
 */
function createLanguageSwitcher() {
  const currentLang = getCurrentLanguage();
  return `
    <div class="lang-switcher" aria-label="Language selector">
      <button 
        class="lang-btn ${currentLang === 'en' ? 'active' : ''}"
        data-lang="en"
        aria-pressed="${currentLang === 'en'}"
      >
        English
      </button>
      <button 
        class="lang-btn ${currentLang === 'ar' ? 'active' : ''}"
        data-lang="ar"
        aria-pressed="${currentLang === 'ar'}"
      >
        العربية
      </button>
    </div>
  `;
}

/**
 * Attach event listeners to language switcher buttons
 * Call this after creating the switcher
 */
function attachLanguageSwitcherListeners(containerSelector = '.lang-switcher') {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;
    
    const lang = btn.getAttribute('data-lang');
    if (VALID_LANGS.includes(lang)) {
      setLanguage(lang);
      
      // Update button states
      container.querySelectorAll('[data-lang]').forEach(b => {
        const isActive = b.getAttribute('data-lang') === lang;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', isActive);
      });
    }
  });
}

// Export for both CommonJS (Node.js) and browser globals
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeLanguage,
    setLanguage,
    getCurrentLanguage,
    getCurrentDirection,
    isRTL,
    wrapNumbersForRTL,
    setDirectionalText,
    createLanguageSwitcher,
    attachLanguageSwitcherListeners,
  };
}
