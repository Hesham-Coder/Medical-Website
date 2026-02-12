/**
 * ============================================
 * ADVANCED ACCESSIBILITY MANAGEMENT SYSTEM
 * WCAG 2.1 AA Compliance & Preference Detection
 * ============================================
 */

class AccessibilityManager {
  constructor(options = {}) {
    this.config = {
      respectReducedMotion: options.respectReducedMotion !== false,
      respectHighContrast: options.respectHighContrast !== false,
      respectColorScheme: options.respectColorScheme !== false,
      enableKeyboardNavigation: options.enableKeyboardNavigation !== false,
      enableScreenReaderSupport: options.enableScreenReaderSupport !== false,
      enableFocusIndicators: options.enableFocusIndicators !== false,
      ...options
    };

    this.state = {
      reducedMotionEnabled: false,
      highContrastEnabled: false,
      darkModeEnabled: false,
      keyboardNavigationActive: false,
      focusIndicatorsVisible: false,
      mediaQueries: new Map(),
      listeners: new Set()
    };

    this.init();
  }

  /**
   * Initialize accessibility manager
   */
  init() {
    this.detectPreferences();
    this.setupMediaQueryListeners();
    this.setupKeyboardNavigation();
    this.setupFocusIndicators();
    this.setupScreenReaderSupport();
    this.setupARIAAttributes();
    this.injectAccessibilityStyles();
    this.logInitialization();
  }

  /**
   * Detect user accessibility preferences
   */
  detectPreferences() {
    if (this.config.respectReducedMotion) {
      this.state.reducedMotionEnabled = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.applyReducedMotion(this.state.reducedMotionEnabled);
    }

    if (this.config.respectHighContrast) {
      this.state.highContrastEnabled = window.matchMedia('(prefers-contrast: more)').matches;
      this.applyHighContrast(this.state.highContrastEnabled);
    }

    if (this.config.respectColorScheme) {
      this.state.darkModeEnabled = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.applyColorScheme(this.state.darkModeEnabled ? 'dark' : 'light');
    }
  }

  /**
   * Setup media query listeners
   */
  setupMediaQueryListeners() {
    if (this.config.respectReducedMotion) {
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotionQuery.addEventListener('change', (e) => {
        this.state.reducedMotionEnabled = e.matches;
        this.applyReducedMotion(e.matches);
        this.dispatchEvent('reducedMotionChanged', { enabled: e.matches });
      });
      this.state.mediaQueries.set('reducedMotion', reducedMotionQuery);
    }

    if (this.config.respectHighContrast) {
      const highContrastQuery = window.matchMedia('(prefers-contrast: more)');
      highContrastQuery.addEventListener('change', (e) => {
        this.state.highContrastEnabled = e.matches;
        this.applyHighContrast(e.matches);
        this.dispatchEvent('highContrastChanged', { enabled: e.matches });
      });
      this.state.mediaQueries.set('highContrast', highContrastQuery);
    }

    if (this.config.respectColorScheme) {
      const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      colorSchemeQuery.addEventListener('change', (e) => {
        this.state.darkModeEnabled = e.matches;
        this.applyColorScheme(e.matches ? 'dark' : 'light');
        this.dispatchEvent('colorSchemeChanged', { scheme: e.matches ? 'dark' : 'light' });
      });
      this.state.mediaQueries.set('colorScheme', colorSchemeQuery);
    }
  }

  /**
   * Apply reduced motion preferences
   */
  applyReducedMotion(enabled) {
    if (enabled) {
      document.documentElement.classList.add('a11y-reduced-motion');
      this.injectStyle(`
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `);
    } else {
      document.documentElement.classList.remove('a11y-reduced-motion');
    }
  }

  /**
   * Apply high contrast preferences
   */
  applyHighContrast(enabled) {
    if (enabled) {
      document.documentElement.classList.add('a11y-high-contrast');
      this.injectStyle(`
        body {
          --opacity-inactive: 0.3;
          --blur-inactive: blur(0px);
          --grayscale-inactive: grayscale(100%);
        }
        
        section.focus-active {
          --opacity-active: 1;
          --blur-active: blur(0px);
          --grayscale-active: grayscale(0%);
        }
        
        button, a, input, textarea, select {
          border: 2px solid currentColor;
        }
      `);
    } else {
      document.documentElement.classList.remove('a11y-high-contrast');
    }
  }

  /**
   * Apply color scheme preferences
   */
  applyColorScheme(scheme) {
    if (scheme === 'dark') {
      document.documentElement.classList.add('a11y-dark-mode');
    } else {
      document.documentElement.classList.remove('a11y-dark-mode');
    }
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    if (!this.config.enableKeyboardNavigation) return;

    // Detect keyboard usage
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        this.state.keyboardNavigationActive = true;
        document.documentElement.classList.add('a11y-keyboard-nav');
      }
    });

    document.addEventListener('mousedown', () => {
      this.state.keyboardNavigationActive = false;
      document.documentElement.classList.remove('a11y-keyboard-nav');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Alt + S: Skip to main content
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        const mainContent = document.querySelector('main') || document.querySelector('section');
        if (mainContent) {
          mainContent.focus();
          mainContent.scrollIntoView({ behavior: 'smooth' });
        }
      }

      // Alt + H: Toggle focus zone indicator (debug)
      if (e.altKey && e.key === 'h') {
        e.preventDefault();
        this.toggleFocusZoneIndicator();
      }

      // Alt + L: Toggle language (if language manager exists)
      if (e.altKey && e.key === 'l') {
        e.preventDefault();
        if (window.languageManager) {
          const currentLang = window.languageManager.getCurrentLanguage();
          const nextLang = currentLang === 'en' ? 'ar' : 'en';
          window.languageManager.switchLanguage(nextLang);
        }
      }
    });
  }

  /**
   * Setup focus indicators
   */
  setupFocusIndicators() {
    if (!this.config.enableFocusIndicators) return;

    this.injectStyle(`
      /* Focus indicators for keyboard navigation */
      button:focus-visible,
      a:focus-visible,
      input:focus-visible,
      textarea:focus-visible,
      select:focus-visible,
      [tabindex]:focus-visible {
        outline: 3px solid #3b82f6;
        outline-offset: 2px;
      }

      /* Skip to main content link */
      .skip-to-main {
        position: absolute;
        top: -40px;
        left: 0;
        background: #3b82f6;
        color: white;
        padding: 8px;
        text-decoration: none;
        z-index: 100;
      }

      .skip-to-main:focus {
        top: 0;
      }

      /* High contrast focus indicators */
      .a11y-high-contrast button:focus-visible,
      .a11y-high-contrast a:focus-visible,
      .a11y-high-contrast input:focus-visible {
        outline: 4px solid currentColor;
        outline-offset: 3px;
      }
    `);
  }

  /**
   * Setup screen reader support
   */
  setupScreenReaderSupport() {
    if (!this.config.enableScreenReaderSupport) return;

    // Add skip to main content link
    if (!document.querySelector('.skip-to-main')) {
      const skipLink = document.createElement('a');
      skipLink.href = '#main';
      skipLink.className = 'skip-to-main';
      skipLink.textContent = 'Skip to main content';
      document.body.insertBefore(skipLink, document.body.firstChild);
    }

    // Ensure main content has id
    let main = document.querySelector('main');
    if (!main) {
      main = document.querySelector('section');
      if (main && !main.id) {
        main.id = 'main';
      }
    }

    // Add ARIA labels to sections
    document.querySelectorAll('section').forEach((section, index) => {
      if (!section.getAttribute('aria-label') && !section.getAttribute('aria-labelledby')) {
        const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
        if (heading) {
          if (!heading.id) {
            heading.id = `section-heading-${index}`;
          }
          section.setAttribute('aria-labelledby', heading.id);
        } else {
          section.setAttribute('aria-label', `Section ${index + 1}`);
        }
      }
    });

    // Add ARIA live regions for dynamic content
    const liveRegion = document.createElement('div');
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.id = 'sr-live-region';
    document.body.appendChild(liveRegion);
  }

  /**
   * Setup ARIA attributes
   */
  setupARIAAttributes() {
    // Add ARIA attributes to navigation
    const nav = document.querySelector('nav');
    if (nav) {
      nav.setAttribute('role', 'navigation');
      nav.setAttribute('aria-label', 'Main navigation');
    }

    // Add ARIA attributes to buttons
    document.querySelectorAll('button').forEach(btn => {
      if (!btn.getAttribute('aria-label') && !btn.textContent.trim()) {
        console.warn('Button without label found:', btn);
      }
    });

    // Add ARIA attributes to forms
    document.querySelectorAll('form').forEach((form, index) => {
      if (!form.id) {
        form.id = `form-${index}`;
      }
      form.setAttribute('role', 'form');
    });

    // Add ARIA attributes to images
    document.querySelectorAll('img').forEach(img => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        img.setAttribute('role', 'presentation');
      }
    });
  }

  /**
   * Inject accessibility styles
   */
  injectAccessibilityStyles() {
    this.injectStyle(`
      /* Screen reader only content */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }

      /* Focus visible for keyboard navigation */
      .a11y-keyboard-nav *:focus {
        outline: 3px solid #3b82f6;
        outline-offset: 2px;
      }

      /* Reduced motion adjustments */
      .a11y-reduced-motion * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }

      /* High contrast adjustments */
      .a11y-high-contrast {
        --opacity-inactive: 0.3;
        --blur-inactive: blur(0px);
        --grayscale-inactive: grayscale(100%);
      }

      /* Dark mode adjustments */
      .a11y-dark-mode {
        background: #1a1a1a;
        color: #ffffff;
      }

      /* Ensure text is readable */
      body {
        font-size: 16px;
        line-height: 1.5;
      }

      /* Ensure links are underlined */
      a {
        text-decoration: underline;
      }

      /* Ensure buttons have sufficient contrast */
      button {
        min-height: 44px;
        min-width: 44px;
      }
    `);
  }

  /**
   * Inject style into document
   */
  injectStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  /**
   * Toggle focus zone indicator (debug)
   */
  toggleFocusZoneIndicator() {
    const indicator = document.querySelector('.focus-zone-indicator');
    if (indicator) {
      indicator.style.display = indicator.style.display === 'none' ? 'block' : 'none';
    }
  }

  /**
   * Announce message to screen readers
   */
  announceToScreenReader(message, priority = 'polite') {
    const liveRegion = document.getElementById('sr-live-region');
    if (liveRegion) {
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.textContent = message;
    }
  }

  /**
   * Check if reduced motion is enabled
   */
  isReducedMotionEnabled() {
    return this.state.reducedMotionEnabled;
  }

  /**
   * Check if high contrast is enabled
   */
  isHighContrastEnabled() {
    return this.state.highContrastEnabled;
  }

  /**
   * Check if dark mode is enabled
   */
  isDarkModeEnabled() {
    return this.state.darkModeEnabled;
  }

  /**
   * Check if keyboard navigation is active
   */
  isKeyboardNavigationActive() {
    return this.state.keyboardNavigationActive;
  }

  /**
   * Get all accessibility preferences
   */
  getPreferences() {
    return {
      reducedMotion: this.state.reducedMotionEnabled,
      highContrast: this.state.highContrastEnabled,
      darkMode: this.state.darkModeEnabled,
      keyboardNavigation: this.state.keyboardNavigationActive
    };
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
    const event = new CustomEvent(`a11y:${eventName}`, { detail });
    document.dispatchEvent(event);

    if (this.state.listeners.has(eventName)) {
      this.state.listeners.get(eventName).forEach(callback => {
        callback(detail);
      });
    }
  }

  /**
   * Log initialization status
   */
  logInitialization() {
    console.log('%c✓ Accessibility Manager Initialized', 'color: #10b981; font-weight: bold;');
    console.log('%cPreferences:', 'color: #3b82f6; font-weight: bold;', this.getPreferences());
    console.log('%cKeyboard Shortcuts:', 'color: #f59e0b; font-weight: bold;', {
      'Alt + S': 'Skip to main content',
      'Alt + H': 'Toggle focus zone indicator',
      'Alt + L': 'Toggle language'
    });
  }

  /**
   * Destroy instance
   */
  destroy() {
    this.state.listeners.clear();
    this.state.mediaQueries.clear();
    console.log('✓ Accessibility Manager Destroyed');
  }
}

// Auto-initialize if data attribute is present
document.addEventListener('DOMContentLoaded', () => {
  if (document.documentElement.hasAttribute('data-accessibility-manager')) {
    const options = {};
    const attr = document.documentElement.getAttribute('data-accessibility-manager');

    if (attr && attr !== 'true') {
      try {
        Object.assign(options, JSON.parse(attr));
      } catch (e) {
        console.warn('Invalid data-accessibility-manager JSON:', e);
      }
    }

    window.accessibilityManager = new AccessibilityManager(options);
  }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AccessibilityManager;
}
