/**
 * ============================================
 * ATTENTION-GUIDED NAVIGATION SYSTEM
 * Premium Depth-of-Field Effect Engine
 * ============================================
 * 
 * Features:
 * - GPU-accelerated Intersection Observer
 * - Intelligent Focus Zone Detection
 * - Staggered Child Element Animations
 * - Language Switching with Smooth Transitions
 * - Full Accessibility Support (prefers-reduced-motion)
 * - Performance Optimized (60fps target)
 */

class AttentionGuidedNavigation {
  constructor(options = {}) {
    // Configuration
    this.config = {
      focusZoneMargin: options.focusZoneMargin || '20% 0px 20% 0px',
      observerThreshold: options.observerThreshold || 0.5,
      debugMode: options.debugMode || false,
      enableLanguageTransition: options.enableLanguageTransition !== false,
      transitionDuration: options.transitionDuration || 300,
      staggerDelay: options.staggerDelay || 80,
      ...options
    };

    // State Management
    this.state = {
      activeSectionId: null,
      currentLanguage: this.getStoredLanguage(),
      isTransitioning: false,
      reducedMotionEnabled: this.checkReducedMotion(),
      sections: new Map(),
      observer: null
    };

    // Initialize
    this.init();
  }

  /**
   * Initialize the entire system
   */
  init() {
    this.setupIntersectionObserver();
    this.setupLanguageSystem();
    this.setupAccessibilityListeners();
    this.createDebugElements();
    this.logInitialization();
  }

  /**
   * Setup Intersection Observer with focus zone detection
   */
  setupIntersectionObserver() {
    const observerOptions = {
      root: null,
      rootMargin: this.config.focusZoneMargin,
      threshold: this.config.observerThreshold
    };

    this.state.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const sectionId = entry.target.id;
        
        if (entry.isIntersecting) {
          // Section entering focus zone
          this.activateSection(entry.target);
          this.state.activeSectionId = sectionId;
        } else {
          // Section leaving focus zone
          this.deactivateSection(entry.target);
        }
      });
    }, observerOptions);

    // Observe all sections
    document.querySelectorAll('section').forEach(section => {
      this.state.sections.set(section.id, section);
      this.state.observer.observe(section);
    });
  }

  /**
   * Activate a section with focus state
   */
  activateSection(section) {
    // Remove focus-active from all sections
    document.querySelectorAll('section.focus-active').forEach(s => {
      if (s !== section) {
        s.classList.remove('focus-active');
      }
    });

    // Add focus-active to current section
    section.classList.add('focus-active');

    // Trigger stagger animation for child elements
    this.triggerStaggerAnimation(section);

    // Dispatch custom event
    this.dispatchEvent('sectionFocused', { sectionId: section.id });
  }

  /**
   * Deactivate a section
   */
  deactivateSection(section) {
    section.classList.remove('focus-active');
    this.dispatchEvent('sectionBlurred', { sectionId: section.id });
  }

  /**
   * Trigger stagger animation for child elements
   */
  triggerStaggerAnimation(section) {
    if (this.state.reducedMotionEnabled) return;

    const children = section.querySelectorAll('.stagger-child');
    children.forEach((child, index) => {
      // Reset animation
      child.style.animation = 'none';
      
      // Trigger reflow to restart animation
      void child.offsetWidth;
      
      // Apply animation with stagger delay
      const delay = index * this.config.staggerDelay;
      child.style.animation = `staggerReveal ${this.getCSSVariableValue('--focus-duration')} ${this.getCSSVariableValue('--focus-easing')} ${delay}ms forwards`;
    });
  }

  /**
   * Setup Language Switching System
   */
  setupLanguageSystem() {
    // Create language transition overlay
    this.createLanguageTransitionOverlay();

    // Listen for language change events
    document.addEventListener('languageChange', (e) => {
      this.handleLanguageChange(e.detail.language);
    });

    // Setup language switcher if it exists
    const languageSwitcher = document.querySelector('[data-language-switcher]');
    if (languageSwitcher) {
      const buttons = languageSwitcher.querySelectorAll('[data-lang]');
      buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const lang = btn.dataset.lang;
          this.switchLanguage(lang);
        });
      });
    }
  }

  /**
   * Create language transition overlay
   */
  createLanguageTransitionOverlay() {
    let overlay = document.querySelector('.language-transition-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'language-transition-overlay';
      document.body.appendChild(overlay);
    }
    this.languageOverlay = overlay;
  }

  /**
   * Switch language with smooth transition
   */
  switchLanguage(newLanguage) {
    if (newLanguage === this.state.currentLanguage || this.state.isTransitioning) {
      return;
    }

    this.state.isTransitioning = true;

    // Step 1: Fade out
    this.fadeOutPage();

    // Step 2: Show transition overlay
    setTimeout(() => {
      this.languageOverlay.classList.add('active');
      document.body.classList.add('language-transitioning');
    }, this.config.transitionDuration / 2);

    // Step 3: Perform language switch
    setTimeout(() => {
      this.performLanguageSwitch(newLanguage);
    }, this.config.transitionDuration);

    // Step 4: Hide overlay and fade in
    setTimeout(() => {
      this.languageOverlay.classList.remove('active');
      document.body.classList.remove('language-transitioning');
      this.fadeInPage();
      this.state.isTransitioning = false;
    }, this.config.transitionDuration + 100);
  }

  /**
   * Perform actual language switch
   */
  performLanguageSwitch(newLanguage) {
    // Store language preference
    localStorage.setItem('preferredLanguage', newLanguage);
    this.state.currentLanguage = newLanguage;

    // Update HTML lang attribute
    document.documentElement.lang = newLanguage;
    document.documentElement.dir = newLanguage === 'ar' ? 'rtl' : 'ltr';

    // Dispatch custom event for other systems to listen
    this.dispatchEvent('languageSwitched', { language: newLanguage });

    // Update UI elements
    this.updateUILanguage(newLanguage);
  }

  /**
   * Update UI elements based on language
   */
  updateUILanguage(language) {
    // Update all elements with data-content attributes
    document.querySelectorAll('[data-content]').forEach(el => {
      const key = el.dataset.content;
      const content = this.getContentByKey(key, language);
      if (content) {
        el.textContent = content;
      }
    });

    // Update all elements with data-lang-en or data-lang-ar
    document.querySelectorAll('[data-lang-en], [data-lang-ar]').forEach(el => {
      const langKey = `data-lang-${language}`;
      if (el.hasAttribute(langKey)) {
        el.textContent = el.getAttribute(langKey);
      }
    });

    // Update language switcher active state
    const languageSwitcher = document.querySelector('[data-language-switcher]');
    if (languageSwitcher) {
      languageSwitcher.querySelectorAll('[data-lang]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === language);
      });
    }
  }

  /**
   * Get content by key (supports nested keys like "section.heading")
   */
  getContentByKey(key, language) {
    // This would typically fetch from your content API or data structure
    // For now, returning null to be implemented by the consuming application
    return null;
  }

  /**
   * Handle language change event
   */
  handleLanguageChange(language) {
    this.switchLanguage(language);
  }

  /**
   * Fade out page
   */
  fadeOutPage() {
    document.body.classList.add('fade-out');
  }

  /**
   * Fade in page
   */
  fadeInPage() {
    document.body.classList.remove('fade-out');
    document.body.classList.add('fade-in');
    
    setTimeout(() => {
      document.body.classList.remove('fade-in');
    }, this.config.transitionDuration);
  }

  /**
   * Setup Accessibility Listeners
   */
  setupAccessibilityListeners() {
    // Check for reduced motion preference changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', (e) => {
      this.state.reducedMotionEnabled = e.matches;
      this.logAccessibilityStatus();
    });

    // Check for high contrast preference
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');
    contrastQuery.addEventListener('change', (e) => {
      this.dispatchEvent('contrastPreferenceChanged', { highContrast: e.matches });
    });

    // Check for color scheme preference
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    colorSchemeQuery.addEventListener('change', (e) => {
      this.dispatchEvent('colorSchemeChanged', { darkMode: e.matches });
    });
  }

  /**
   * Check if reduced motion is enabled
   */
  checkReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Get stored language preference
   */
  getStoredLanguage() {
    return localStorage.getItem('preferredLanguage') || 
           document.documentElement.lang || 
           'en';
  }

  /**
   * Get CSS variable value
   */
  getCSSVariableValue(varName) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
  }

  /**
   * Create debug elements
   */
  createDebugElements() {
    if (!this.config.debugMode) return;

    const indicator = document.createElement('div');
    indicator.className = 'focus-zone-indicator';
    document.body.appendChild(indicator);

    document.body.classList.add('debug-focus-zone');

    console.log('🔍 Debug Mode Enabled - Focus Zone Indicator Visible');
  }

  /**
   * Dispatch custom event
   */
  dispatchEvent(eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail });
    document.dispatchEvent(event);
  }

  /**
   * Log initialization status
   */
  logInitialization() {
    console.log('%c✓ Attention-Guided Navigation System Initialized', 'color: #10b981; font-weight: bold;');
    console.log('%cConfiguration:', 'color: #3b82f6; font-weight: bold;', {
      focusZoneMargin: this.config.focusZoneMargin,
      observerThreshold: this.config.observerThreshold,
      debugMode: this.config.debugMode,
      reducedMotionEnabled: this.state.reducedMotionEnabled,
      currentLanguage: this.state.currentLanguage
    });
  }

  /**
   * Log accessibility status
   */
  logAccessibilityStatus() {
    console.log('%cAccessibility Status Updated:', 'color: #f59e0b; font-weight: bold;', {
      reducedMotionEnabled: this.state.reducedMotionEnabled
    });
  }

  /**
   * Public API: Update focus zone margin
   */
  setFocusZoneMargin(margin) {
    this.config.focusZoneMargin = margin;
    this.setupIntersectionObserver();
  }

  /**
   * Public API: Get active section
   */
  getActiveSection() {
    return this.state.activeSectionId;
  }

  /**
   * Public API: Get current language
   */
  getCurrentLanguage() {
    return this.state.currentLanguage;
  }

  /**
   * Public API: Enable/Disable debug mode
   */
  setDebugMode(enabled) {
    this.config.debugMode = enabled;
    if (enabled) {
      this.createDebugElements();
    } else {
      const indicator = document.querySelector('.focus-zone-indicator');
      if (indicator) indicator.remove();
      document.body.classList.remove('debug-focus-zone');
    }
  }

  /**
   * Public API: Destroy instance
   */
  destroy() {
    if (this.state.observer) {
      this.state.observer.disconnect();
    }
    console.log('✓ Attention-Guided Navigation System Destroyed');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AttentionGuidedNavigation;
}

// Auto-initialize if data attribute is present
document.addEventListener('DOMContentLoaded', () => {
  if (document.documentElement.hasAttribute('data-attention-guided-nav')) {
    const options = {};
    const attr = document.documentElement.getAttribute('data-attention-guided-nav');
    
    if (attr && attr !== 'true') {
      try {
        Object.assign(options, JSON.parse(attr));
      } catch (e) {
        console.warn('Invalid data-attention-guided-nav JSON:', e);
      }
    }

    window.attentionNav = new AttentionGuidedNavigation(options);
  }
});
