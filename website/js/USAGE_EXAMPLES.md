# Attention-Guided Navigation System - Usage Examples

## Quick Start

### Basic Initialization
```html
<!-- Include CSS -->
<link rel="stylesheet" href="/css/attention-guided-nav.css">

<!-- Include JavaScript -->
<script src="/js/attention-guided-nav.js"></script>
<script src="/js/language-manager.js"></script>
<script src="/js/accessibility-manager.js"></script>

<!-- Initialize -->
<script>
  const attentionNav = new AttentionGuidedNavigation();
  const languageManager = new LanguageManager();
  const accessibilityManager = new AccessibilityManager();
</script>
```

---

## Advanced Examples

### 1. Custom Focus Zone Configuration
```javascript
const attentionNav = new AttentionGuidedNavigation({
  focusZoneMargin: '30% 0px 30% 0px',  // Larger focus zone
  observerThreshold: 0.7,               // Higher threshold
  debugMode: true,                      // Show debug indicators
  transitionDuration: 500,              // Slower transitions
  staggerDelay: 100                     // Longer stagger delays
});
```

### 2. Listening to Focus Events
```javascript
document.addEventListener('sectionFocused', (e) => {
  console.log('Section focused:', e.detail.sectionId);
  
  // Trigger analytics
  gtag('event', 'section_viewed', {
    section_id: e.detail.sectionId
  });
});

document.addEventListener('sectionBlurred', (e) => {
  console.log('Section blurred:', e.detail.sectionId);
});
```

### 3. Programmatic Language Switching
```javascript
// Get current language
const currentLang = window.languageManager.getCurrentLanguage();
console.log('Current language:', currentLang);

// Switch to Arabic
window.languageManager.switchLanguage('ar');

// Listen for language changes
document.addEventListener('language:languageSwitched', (e) => {
  console.log('Language switched to:', e.detail.language);
});
```

### 4. Custom Content Loading
```javascript
// Set custom content for a language
const customContent = {
  siteInfo: {
    title: { en: 'My Site', ar: 'موقعي' },
    description: { en: 'My description', ar: 'وصفي' }
  }
};

window.languageManager.setContent('en', customContent);
```

### 5. Accessibility Preferences Detection
```javascript
// Check current preferences
const prefs = window.accessibilityManager.getPreferences();
console.log('Accessibility preferences:', prefs);

// Listen for preference changes
document.addEventListener('a11y:reducedMotionChanged', (e) => {
  console.log('Reduced motion:', e.detail.enabled);
});

document.addEventListener('a11y:highContrastChanged', (e) => {
  console.log('High contrast:', e.detail.enabled);
});

// Announce to screen readers
window.accessibilityManager.announceToScreenReader(
  'Content loaded successfully',
  'polite'
);
```

### 6. Custom CSS Variable Tweaking
```javascript
// Adjust focus zone intensities at runtime
const root = document.documentElement;

// Stronger blur effect
root.style.setProperty('--blur-inactive', 'blur(15px)');
root.style.setProperty('--grayscale-inactive', 'grayscale(100%)');

// Faster transitions
root.style.setProperty('--focus-duration', '0.4s');
root.style.setProperty('--stagger-delay', '40ms');
```

### 7. HTML Structure with Stagger Animation
```html
<section id="team">
  <h2>Our Team</h2>
  
  <!-- These will animate in sequence -->
  <div class="stagger-child card-focus-aware">
    <h3 class="text-focus-aware">Dr. Smith</h3>
    <img class="image-focus-aware" src="doctor.jpg" alt="Dr. Smith">
  </div>
  
  <div class="stagger-child card-focus-aware">
    <h3 class="text-focus-aware">Dr. Johnson</h3>
    <img class="image-focus-aware" src="doctor2.jpg" alt="Dr. Johnson">
  </div>
  
  <div class="stagger-child card-focus-aware">
    <h3 class="text-focus-aware">Dr. Williams</h3>
    <img class="image-focus-aware" src="doctor3.jpg" alt="Dr. Williams">
  </div>
</section>
```

### 8. Dynamic Content Updates
```javascript
// When content changes, refresh the page
document.addEventListener('contentUpdated', () => {
  // Refresh all systems
  window.attentionNav.setupIntersectionObserver();
  window.languageManager.updatePageContent(
    window.languageManager.getCurrentLanguage()
  );
});
```

### 9. Enable Debug Mode
```javascript
// Show focus zone indicator
window.attentionNav.setDebugMode(true);

// Keyboard shortcut: Alt + H to toggle
// Keyboard shortcut: Alt + L to toggle language
// Keyboard shortcut: Alt + S to skip to main content
```

### 10. Integration with Analytics
```javascript
// Track focus changes
document.addEventListener('sectionFocused', (e) => {
  // Google Analytics
  gtag('event', 'page_section', {
    section_name: e.detail.sectionId,
    engagement_time_msec: 100
  });
});

// Track language changes
document.addEventListener('language:languageSwitched', (e) => {
  gtag('event', 'language_change', {
    language: e.detail.language
  });
});

// Track accessibility preferences
document.addEventListener('a11y:reducedMotionChanged', (e) => {
  gtag('event', 'accessibility_preference', {
    preference: 'reduced_motion',
    enabled: e.detail.enabled
  });
});
```

### 11. Mobile Optimization
```javascript
// Adjust for mobile devices
if (window.innerWidth < 768) {
  window.attentionNav.setFocusZoneMargin('40% 0px 40% 0px');
  
  // Reduce animation complexity
  document.documentElement.style.setProperty('--stagger-delay', '50ms');
}
```

### 12. Performance Monitoring
```javascript
// Monitor performance
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Performance:', entry.name, entry.duration);
  }
});

observer.observe({ entryTypes: ['measure', 'navigation'] });

// Mark section focus events
document.addEventListener('sectionFocused', (e) => {
  performance.mark(`section-${e.detail.sectionId}-focused`);
});
```

### 13. Custom Event Handling
```javascript
// Create custom event handlers
class MyCustomHandler {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    document.addEventListener('sectionFocused', (e) => {
      this.onSectionFocus(e.detail.sectionId);
    });

    document.addEventListener('language:languageSwitched', (e) => {
      this.onLanguageSwitch(e.detail.language);
    });

    document.addEventListener('a11y:reducedMotionChanged', (e) => {
      this.onAccessibilityChange(e.detail);
    });
  }

  onSectionFocus(sectionId) {
    console.log('Custom handler: Section focused', sectionId);
  }

  onLanguageSwitch(language) {
    console.log('Custom handler: Language switched', language);
  }

  onAccessibilityChange(detail) {
    console.log('Custom handler: Accessibility changed', detail);
  }
}

const handler = new MyCustomHandler();
```

### 14. Testing Accessibility Features
```javascript
// Test reduced motion
window.matchMedia('(prefers-reduced-motion: reduce)').addListener((e) => {
  console.log('Reduced motion:', e.matches);
});

// Test high contrast
window.matchMedia('(prefers-contrast: more)').addListener((e) => {
  console.log('High contrast:', e.matches);
});

// Test dark mode
window.matchMedia('(prefers-color-scheme: dark)').addListener((e) => {
  console.log('Dark mode:', e.matches);
});
```

### 15. Cleanup and Destruction
```javascript
// When leaving the page or removing the system
window.attentionNav.destroy();
window.languageManager.destroy();
window.accessibilityManager.destroy();

console.log('All systems cleaned up');
```

---

## Best Practices

### 1. Always Check for Reduced Motion
```javascript
if (!window.accessibilityManager.isReducedMotionEnabled()) {
  // Only run animations if reduced motion is not enabled
  element.style.animation = 'slideIn 0.5s ease-out';
}
```

### 2. Use Semantic HTML
```html
<!-- Good -->
<section id="services">
  <h2>Our Services</h2>
  <!-- content -->
</section>

<!-- Bad -->
<div id="services">
  <h2>Our Services</h2>
  <!-- content -->
</div>
```

### 3. Provide ARIA Labels
```html
<section id="team" aria-label="Meet Our Team">
  <!-- content -->
</section>
```

### 4. Test on Real Devices
- Test on mobile devices
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Test with keyboard navigation only
- Test with reduced motion enabled

### 5. Monitor Performance
- Use Chrome DevTools Performance tab
- Target 60fps for smooth scrolling
- Check GPU acceleration in Rendering tab
- Monitor memory usage

---

## Troubleshooting

### Sections not animating
- Ensure sections have unique `id` attributes
- Check that CSS file is loaded
- Verify JavaScript console for errors

### Language switch not working
- Ensure content API is accessible
- Check browser console for CORS errors
- Verify content structure matches expected format

### Accessibility features not working
- Test in DevTools with media query emulation
- Check that accessibility manager is initialized
- Verify ARIA attributes are present

### Performance issues
- Reduce number of stagger children
- Disable debug mode in production
- Check for layout thrashing in DevTools
- Consider lazy loading images

---

## API Reference

### AttentionGuidedNavigation
- `setFocusZoneMargin(margin)` - Update focus zone
- `getActiveSection()` - Get current active section
- `getCurrentLanguage()` - Get current language
- `setDebugMode(enabled)` - Enable/disable debug
- `destroy()` - Clean up

### LanguageManager
- `switchLanguage(language)` - Switch language
- `getCurrentLanguage()` - Get current language
- `getSupportedLanguages()` - Get supported languages
- `setContent(language, content)` - Set custom content
- `getContent(language)` - Get cached content

### AccessibilityManager
- `isReducedMotionEnabled()` - Check reduced motion
- `isHighContrastEnabled()` - Check high contrast
- `isDarkModeEnabled()` - Check dark mode
- `getPreferences()` - Get all preferences
- `announceToScreenReader(message, priority)` - Announce message

---

**For more information, see ATTENTION_NAV_DOCUMENTATION.md**
