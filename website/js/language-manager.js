/**
 * ============================================
 * ADVANCED LANGUAGE MANAGEMENT SYSTEM
 * With Smooth Transitions & Content Sync
 * ============================================
 */

class LanguageManager {
  constructor(options = {}) {
    this.config = {
      defaultLanguage: options.defaultLanguage || 'en',
      supportedLanguages: options.supportedLanguages || ['en', 'ar'],
      contentAPI: options.contentAPI || '/api/public/content',
      storageKey: options.storageKey || 'preferredLanguage',
      transitionDuration: options.transitionDuration || 300,
      enableAutoDetect: options.enableAutoDetect !== false,
      ...options
    };

    this.state = {
      currentLanguage: this.getStoredLanguage(),
      contentCache: new Map(),
      isTransitioning: false,
      listeners: new Set()
    };

    this.init();
  }

  /**
   * Initialize language manager
   */
  init() {
    this.setupLanguageSwitcher();
    this.loadContent();
    this.applyLanguage(this.state.currentLanguage);
    this.setupAutoDetection();
    this.logInitialization();
  }

  /**
   * Setup language switcher UI
   */
  setupLanguageSwitcher() {
    const switcher = document.querySelector('[data-language-switcher]');
    if (!switcher) return;

    const buttons = switcher.querySelectorAll('[data-lang]');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const lang = btn.dataset.lang;
        this.switchLanguage(lang);
      });

      // Set active state
      if (btn.dataset.lang === this.state.currentLanguage) {
        btn.classList.add('active');
      }
    });
  }

  /**
   * Switch language with transition
   */
  switchLanguage(newLanguage) {
    if (newLanguage === this.state.currentLanguage || this.state.isTransitioning) {
      return;
    }

    if (!this.config.supportedLanguages.includes(newLanguage)) {
      console.warn(`Language '${newLanguage}' is not supported.`);
      return;
    }

    this.state.isTransitioning = true;

    // Step 1: Fade out
    this.fadeOut();

    // Step 2: Switch language
    setTimeout(() => {
      this.applyLanguage(newLanguage);
      this.state.currentLanguage = newLanguage;
      localStorage.setItem(this.config.storageKey, newLanguage);
      this.updateLanguageSwitcher();
      this.dispatchEvent('languageSwitched', { language: newLanguage });
    }, this.config.transitionDuration / 2);

    // Step 3: Fade in
    setTimeout(() => {
      this.fadeIn();
      this.state.isTransitioning = false;
    }, this.config.transitionDuration);
  }

  /**
   * Apply language to page
   */
  applyLanguage(language) {
    // Update HTML attributes
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';

    // Update content
    this.updatePageContent(language);
  }

  /**
   * Update page content based on language
   */
  updatePageContent(language) {
    // Update elements with data-content attribute
    document.querySelectorAll('[data-content]').forEach(el => {
      const key = el.dataset.content;
      const content = this.getContentByKey(key, language);
      if (content) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = content;
        } else {
          el.textContent = content;
        }
      }
    });

    // Update elements with data-html-content attribute
    document.querySelectorAll('[data-html-content]').forEach(el => {
      const key = el.dataset.htmlContent;
      const content = this.getContentByKey(key, language);
      if (content) {
        el.innerHTML = content;
      }
    });

    // Update image alt text
    document.querySelectorAll('[data-alt-content]').forEach(el => {
      const key = el.dataset.altContent;
      const content = this.getContentByKey(key, language);
      if (content) {
        el.alt = content;
      }
    });

    // Update title and meta tags
    this.updateMetaTags(language);
  }

  /**
   * Update meta tags
   */
  updateMetaTags(language) {
    const titleContent = this.getContentByKey('siteInfo.title', language);
    if (titleContent) {
      document.title = titleContent;
    }

    const descriptionContent = this.getContentByKey('siteInfo.description', language);
    if (descriptionContent) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = descriptionContent;
    }

    // Update og:title and og:description
    const ogTitle = this.getContentByKey('siteInfo.title', language);
    if (ogTitle) {
      let metaOgTitle = document.querySelector('meta[property="og:title"]');
      if (!metaOgTitle) {
        metaOgTitle = document.createElement('meta');
        metaOgTitle.setAttribute('property', 'og:title');
        document.head.appendChild(metaOgTitle);
      }
      metaOgTitle.content = ogTitle;
    }
  }

  /**
   * Get content by key (supports nested keys)
   */
  getContentByKey(key, language) {
    const parts = key.split('.');
    let content = this.state.contentCache.get(language);

    if (!content) return null;

    for (const part of parts) {
      if (content && typeof content === 'object') {
        content = content[part];
      } else {
        return null;
      }
    }

    // Handle bilingual content
    if (typeof content === 'object' && content.en && content.ar) {
      return content[language] || content.en;
    }

    return content;
  }

  /**
   * Load content from API
   */
  async loadContent() {
    try {
      const response = await fetch(this.config.contentAPI);
      const data = await response.json();

      // Cache content for all supported languages
      this.config.supportedLanguages.forEach(lang => {
        this.state.contentCache.set(lang, data);
      });

      this.dispatchEvent('contentLoaded', { languages: this.config.supportedLanguages });
    } catch (error) {
      console.error('Failed to load content:', error);
      this.dispatchEvent('contentLoadError', { error });
    }
  }

  /**
   * Fade out page
   */
  fadeOut() {
    document.body.style.opacity = '0';
    document.body.style.transition = `opacity ${this.config.transitionDuration}ms ease-out`;
  }

  /**
   * Fade in page
   */
  fadeIn() {
    document.body.style.opacity = '1';
    document.body.style.transition = `opacity ${this.config.transitionDuration}ms ease-in`;
  }

  /**
   * Update language switcher UI
   */
  updateLanguageSwitcher() {
    const switcher = document.querySelector('[data-language-switcher]');
    if (!switcher) return;

    switcher.querySelectorAll('[data-lang]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === this.state.currentLanguage);
    });
  }

  /**
   * Setup auto-detection of browser language
   */
  setupAutoDetection() {
    if (!this.config.enableAutoDetect) return;

    const storedLanguage = localStorage.getItem(this.config.storageKey);
    if (storedLanguage) return; // User has already set a preference

    const browserLanguage = this.detectBrowserLanguage();
    if (browserLanguage && browserLanguage !== this.state.currentLanguage) {
      this.switchLanguage(browserLanguage);
    }
  }

  /**
   * Detect browser language
   */
  detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0].toLowerCase();

    return this.config.supportedLanguages.includes(langCode) ? langCode : null;
  }

  /**
   * Get stored language preference
   */
  getStoredLanguage() {
    const stored = localStorage.getItem(this.config.storageKey);
    if (stored && this.config.supportedLanguages.includes(stored)) {
      return stored;
    }

    const htmlLang = document.documentElement.lang;
    if (htmlLang && this.config.supportedLanguages.includes(htmlLang)) {
      return htmlLang;
    }

    return this.config.defaultLanguage;
  }

  /**
   * Register event listener
   */
  on(eventName, callback) {
    if (!this.state.listeners.has(eventName)) {
      this.state.listeners.set(eventName, new Set());
    }
    this.state.listeners.get(eventName).add(callback);
  }

  /**
   * Unregister event listener
   */
  off(eventName, callback) {
    if (this.state.listeners.has(eventName)) {
      this.state.listeners.get(eventName).delete(callback);
    }
  }

  /**
   * Dispatch event
   */
  dispatchEvent(eventName, detail = {}) {
    // Dispatch custom DOM event
    const event = new CustomEvent(`language:${eventName}`, { detail });
    document.dispatchEvent(event);

    // Call registered listeners
    if (this.state.listeners.has(eventName)) {
      this.state.listeners.get(eventName).forEach(callback => {
        callback(detail);
      });
    }
  }

  /**
   * Get current language
   */
  getCurrentLanguage() {
    return this.state.currentLanguage;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return this.config.supportedLanguages;
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language) {
    return this.config.supportedLanguages.includes(language);
  }

  /**
   * Manually set content (for testing or dynamic content)
   */
  setContent(language, content) {
    if (this.isLanguageSupported(language)) {
      this.state.contentCache.set(language, content);
      if (language === this.state.currentLanguage) {
        this.updatePageContent(language);
      }
    }
  }

  /**
   * Get all cached content for a language
   */
  getContent(language) {
    return this.state.contentCache.get(language) || null;
  }

  /**
   * Log initialization status
   */
  logInitialization() {
    console.log('%c✓ Language Manager Initialized', 'color: #10b981; font-weight: bold;');
    console.log('%cConfiguration:', 'color: #3b82f6; font-weight: bold;', {
      currentLanguage: this.state.currentLanguage,
      supportedLanguages: this.config.supportedLanguages,
      defaultLanguage: this.config.defaultLanguage,
      autoDetect: this.config.enableAutoDetect
    });
  }

  /**
   * Destroy instance
   */
  destroy() {
    this.state.listeners.clear();
    this.state.contentCache.clear();
    console.log('✓ Language Manager Destroyed');
  }
}

// Auto-initialize if data attribute is present
document.addEventListener('DOMContentLoaded', () => {
  if (document.documentElement.hasAttribute('data-language-manager')) {
    const options = {};
    const attr = document.documentElement.getAttribute('data-language-manager');

    if (attr && attr !== 'true') {
      try {
        Object.assign(options, JSON.parse(attr));
      } catch (e) {
        console.warn('Invalid data-language-manager JSON:', e);
      }
    }

    window.languageManager = new LanguageManager(options);
  }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LanguageManager;
}
