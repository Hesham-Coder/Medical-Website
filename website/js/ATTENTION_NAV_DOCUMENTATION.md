# Attention-Guided Navigation System Documentation

## Overview

The **Attention-Guided Navigation System** is a premium, GPU-accelerated depth-of-field effect engine designed for high-end medical websites. It intelligently manages user focus during scrolling by applying sophisticated visual filters to inactive sections while highlighting the active section in the viewport's "Central Reading Zone."

---

## Key Features

### 1. **GPU-Accelerated Rendering**
- All animations use `transform` and `opacity` only (no layout repaints)
- `will-change` and `backface-visibility: hidden` prevent jank
- `transform-style: preserve-3d` ensures crisp text during scaling
- Target: 60fps performance on all modern devices

### 2. **Intelligent Focus Zone Detection**
- **Intersection Observer** with custom `rootMargin` defines the "Central Reading Zone"
- Sections activate only when they occupy the center of the viewport
- Configurable threshold (default: 0.5) ensures user commitment
- Real-time focus state management

### 3. **Visual Choreography**
- **Inactive State**: `blur(10px) grayscale(50%) scale(0.95)` with `opacity: 0.6`
- **Active State**: All filters reset, section "pops" forward
- **Easing**: Custom cubic-bezier `(0.4, 0, 0.2, 1)` for fluid Apple-style motion
- **Staggered Reveals**: Child elements animate in sequence with configurable delays

### 4. **Language Switching**
- Smooth fade-out/fade-in transitions with backdrop blur overlay
- Language preference persisted in localStorage
- HTML `lang` and `dir` attributes automatically updated
- Custom events for integration with other systems

### 5. **Accessibility First**
- **prefers-reduced-motion**: All animations instantly disabled
- **prefers-contrast**: Enhanced visual distinction between active/inactive states
- **prefers-color-scheme**: Dark mode overlay support
- WCAG 2.1 AA compliant

### 6. **Performance Optimized**
- CSS containment for layout isolation
- Minimal JavaScript reflows
- Efficient event delegation
- Debug mode for development

---

## Installation

### Step 1: Include CSS
```html
<link rel="stylesheet" href="/css/attention-guided-nav.css">
```

### Step 2: Include JavaScript
```html
<script src="/js/attention-guided-nav.js"></script>
```

### Step 3: Enable on HTML Element
```html
<html data-attention-guided-nav='{"debugMode": false}'>
```

Or initialize manually:
```javascript
const attentionNav = new AttentionGuidedNavigation({
  focusZoneMargin: '20% 0px 20% 0px',
  observerThreshold: 0.5,
  debugMode: false,
  enableLanguageTransition: true,
  transitionDuration: 300,
  staggerDelay: 80
});
```

---

## CSS Variables (Customizable)

All intensities can be adjusted via CSS custom properties:

```css
:root {
  /* Motion & Animation */
  --focus-duration: 0.8s;
  --focus-easing: cubic-bezier(0.4, 0, 0.2, 1);
  --stagger-delay: 80ms;
  
  /* Depth-of-Field Intensities */
  --blur-inactive: blur(10px);
  --grayscale-inactive: grayscale(50%);
  --scale-inactive: 0.95;
  
  --blur-active: blur(0px);
  --grayscale-active: grayscale(0%);
  --scale-active: 1;
  
  /* Opacity Levels */
  --opacity-inactive: 0.6;
  --opacity-active: 1;
  
  /* Z-Index Management */
  --z-inactive: 1;
  --z-active: 10;
  
  /* Focus Zone Viewport Margins */
  --focus-zone-top: 20%;
  --focus-zone-bottom: 20%;
}
```

### Customization Example
```css
:root {
  --blur-inactive: blur(15px);        /* Stronger blur */
  --grayscale-inactive: grayscale(100%); /* Full grayscale */
  --opacity-inactive: 0.4;            /* More transparent */
  --focus-duration: 1s;               /* Slower transitions */
}
```

---

## HTML Structure Requirements

### Basic Section
```html
<section id="services">
  <h2>Our Services</h2>
  <p>Content here...</p>
</section>
```

### With Staggered Children
```html
<section id="team">
  <h2>Meet Our Team</h2>
  <div class="stagger-child">Card 1</div>
  <div class="stagger-child">Card 2</div>
  <div class="stagger-child">Card 3</div>
</section>
```

### With Focus-Aware Elements
```html
<section id="about">
  <div class="card-focus-aware">
    <h3 class="text-focus-aware">Heading</h3>
    <img class="image-focus-aware" src="image.jpg">
  </div>
</section>
```

---

## JavaScript API

### Initialization
```javascript
const attentionNav = new AttentionGuidedNavigation(options);
```

### Methods

#### `setFocusZoneMargin(margin)`
Update the focus zone viewport margins dynamically.
```javascript
attentionNav.setFocusZoneMargin('30% 0px 30% 0px');
```

#### `getActiveSection()`
Get the ID of the currently active section.
```javascript
const activeSectionId = attentionNav.getActiveSection();
```

#### `getCurrentLanguage()`
Get the current language setting.
```javascript
const lang = attentionNav.getCurrentLanguage(); // 'en' or 'ar'
```

#### `switchLanguage(language)`
Programmatically switch language with smooth transition.
```javascript
attentionNav.switchLanguage('ar');
```

#### `setDebugMode(enabled)`
Enable/disable debug mode (shows focus zone indicator).
```javascript
attentionNav.setDebugMode(true);
```

#### `destroy()`
Clean up and remove all observers.
```javascript
attentionNav.destroy();
```

---

## Custom Events

The system dispatches custom events for integration:

### `sectionFocused`
Fired when a section enters the focus zone.
```javascript
document.addEventListener('sectionFocused', (e) => {
  console.log('Active section:', e.detail.sectionId);
});
```

### `sectionBlurred`
Fired when a section leaves the focus zone.
```javascript
document.addEventListener('sectionBlurred', (e) => {
  console.log('Blurred section:', e.detail.sectionId);
});
```

### `languageSwitched`
Fired after language switch completes.
```javascript
document.addEventListener('languageSwitched', (e) => {
  console.log('New language:', e.detail.language);
});
```

### `contrastPreferenceChanged`
Fired when high contrast preference changes.
```javascript
document.addEventListener('contrastPreferenceChanged', (e) => {
  console.log('High contrast:', e.detail.highContrast);
});
```

### `colorSchemeChanged`
Fired when dark mode preference changes.
```javascript
document.addEventListener('colorSchemeChanged', (e) => {
  console.log('Dark mode:', e.detail.darkMode);
});
```

---

## Performance Considerations

### Best Practices

1. **Use Semantic HTML**
   - Each major section should be a `<section>` element
   - Avoid deeply nested structures

2. **Lazy Load Images**
   - Implement native lazy loading for images in sections
   - Reduces initial paint time

3. **Minimize Stagger Children**
   - Limit to 6-8 stagger children per section
   - Beyond that, performance may degrade

4. **Monitor with DevTools**
   - Use Chrome DevTools Performance tab
   - Look for consistent 60fps in scrolling
   - Check GPU acceleration in Rendering tab

### Browser Support

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✓ Full |
| Firefox 88+ | ✓ Full |
| Safari 14+ | ✓ Full |
| Edge 90+ | ✓ Full |
| Mobile Browsers | ✓ Full (with GPU acceleration) |

---

## Debug Mode

Enable debug mode to visualize the focus zone:

```javascript
attentionNav.setDebugMode(true);
```

This displays:
- A dashed blue border indicating the "Central Reading Zone"
- Console logs with detailed configuration
- Real-time focus state changes

---

## Accessibility Testing

### Test Reduced Motion
```css
/* In DevTools, toggle this media query */
@media (prefers-reduced-motion: reduce) {
  /* All animations should be instant */
}
```

### Test High Contrast
```css
/* In DevTools, toggle this media query */
@media (prefers-contrast: more) {
  /* Filters should be more pronounced */
}
```

### Test Dark Mode
```css
/* In DevTools, toggle this media query */
@media (prefers-color-scheme: dark) {
  /* Overlays should adapt to dark background */
}
```

---

## Troubleshooting

### Issue: Sections not activating
**Solution**: Ensure sections have unique `id` attributes and are direct children of `<body>`.

### Issue: Animations feel janky
**Solution**: Check browser DevTools for layout thrashing. Verify `will-change` is applied correctly.

### Issue: Language switch not working
**Solution**: Ensure `data-content` attributes are present on elements that need translation.

### Issue: Stagger animation not triggering
**Solution**: Add `stagger-child` class to child elements and ensure parent section has `id`.

---

## Advanced Usage

### Custom Easing Function
```css
:root {
  --focus-easing: cubic-bezier(0.25, 0.46, 0.45, 0.94); /* Custom ease */
}
```

### Disable Blur for Performance
```css
:root {
  --blur-inactive: blur(0px);
  --blur-active: blur(0px);
}
```

### Faster Transitions
```css
:root {
  --focus-duration: 0.4s;
  --stagger-delay: 40ms;
}
```

---

## Support & Feedback

For issues or feature requests, please refer to the project documentation or contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: 2025-02-13  
**License**: MIT
