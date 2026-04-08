# RTL/LTR Bilingual Setup Guide

## Problem Explained

When building bilingual applications (Arabic/English), direction mishandling causes:

1. **Layout Inversion**: Elements don't flip between RTL and LTR correctly
2. **Number Flipping**: Numbers inside Arabic text get reversed (123 → 321)
3. **Inconsistent States**: Switching languages doesn't cleanly update the entire page
4. **Accessibility Issues**: Screen readers get confused by direction changes

### Why Numbers Break in RTL

Arabic text is naturally right-to-left. However, **numbers should ALWAYS display left-to-right** (numbers are universal). Without proper handling, the browser's bidirectional text algorithm flips numbers, making "Price: 123 SAR" appear as "SAR 123 :ecirP" (barely readable).

**Solution**: Wrap numbers with Unicode directional markers that tell the browser "treat this as LTR, even though we're in an RTL context."

---

## Solution Architecture

### 1. Single Direction Control Point

```html
<!-- ✅ CORRECT: Direction at root only -->
<html lang="ar" dir="rtl">
  <body>
    <!-- Direction cascades here automatically -->
  </body>
</html>
```

```html
<!-- ❌ WRONG: Multiple direction attributes -->
<html lang="ar" dir="rtl">
  <body dir="rtl">        <!-- Redundant -->
    <div dir="rtl">       <!-- Redundant -->
      <!-- Causes conflicts -->
    </div>
  </body>
</html>
```

### 2. Language Switching Flow

```
User clicks language button
    ↓
setLanguage('ar' or 'en')
    ↓
Update <html lang> and <html dir>
    ↓
Save to localStorage
    ↓
Dispatch 'languageChanged' event
    ↓
CSS automatically reflows (Flexbox/Grid respect dir)
    ↓
Other components listen and adapt as needed
```

### 3. Number Safety Strategy

Use the `wrapNumbersForRTL()` function:

```javascript
// Input:  "Price: 123 SAR"
// Output: "Price: ‪123‬ SAR"  (with Unicode markers)

// The markers (U+202A and U+202C) are invisible to users
// but tell the browser: "keep this section LTR"
```

---

## Implementation

### Step 1: Include Files

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Bidirectional styles -->
  <link rel="stylesheet" href="/rtl-styles.css">
  <style>
    /* Your existing styles */
  </style>
</head>
<body>
  <!-- Your content -->
  
  <!-- Language helper script (must load before other scripts) -->
  <script src="/langHelper.js"></script>
  
  <!-- Initialize on page load -->
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      langHelper.initializeLanguage();
    });
  </script>
</body>
</html>
```

### Step 2: Add Language Switcher

```html
<div id="lang-switcher-container"></div>

<script>
document.addEventListener('DOMContentLoaded', () => {
  // Create switcher
  const container = document.getElementById('lang-switcher-container');
  container.innerHTML = langHelper.createLanguageSwitcher();
  
  // Attach listeners
  langHelper.attachLanguageSwitcherListeners();
});
</script>
```

### Step 3: Handle Dynamic Content with Numbers

```javascript
// ✅ For text with numbers (price, phone, ID)
const priceElement = document.getElementById('price');
langHelper.setDirectionalText(priceElement, 'Price: 1,500 SAR');

// ✅ For phone numbers
const phoneElement = document.getElementById('phone');
langHelper.setDirectionalText(phoneElement, '+966-55-1234-5678');

// ✅ For IDs and codes
const idElement = document.getElementById('order-id');
langHelper.setDirectionalText(idElement, 'Order: 12345-AB');
```

### Step 4: CSS for Your Elements

Use logical properties instead of left/right:

```css
/* ✅ GOOD: Respects direction automatically */
.sidebar {
  padding-inline-start: 24px;  /* Start = left in LTR, right in RTL */
  margin-inline-end: 16px;     /* End = right in LTR, left in RTL */
  text-align: start;           /* Left in LTR, right in RTL */
}

/* ❌ AVOID: Hardcoded directions */
.sidebar {
  padding-left: 24px;    /* Always left, broken in RTL */
  text-align: left;      /* Always left, broken in RTL */
}
```

### Step 5: Listen to Language Changes

```javascript
document.addEventListener('languageChanged', (e) => {
  const { lang, dir } = e.detail;
  console.log(`Language changed to: ${lang} (${dir})`);
  
  // Update any component-specific logic here
  updateComponentTexts();
  redrawCharts();
  // etc.
});
```

---

## CSS Logical Properties Reference

| Purpose | Logical Property | LTR | RTL |
|---------|------------------|-----|-----|
| Left/Right padding | `padding-inline-start` / `padding-inline-end` | left / right | right / left |
| Left/Right margin | `margin-inline-start` / `margin-inline-end` | left / right | right / left |
| Text alignment | `text-align: start` / `end` | left / right | right / left |
| Border start | `border-inline-start` | left | right |
| Border end | `border-inline-end` | right | left |

---

## Common Patterns

### Pattern 1: Form with Labels and Inputs

```html
<div class="form-group">
  <label for="name">Name:</label>
  <input type="text" id="name" dir="inherit">
</div>

<style>
  .form-group {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    /* Automatically respects dir attribute */
  }
  
  label {
    flex-shrink: 0;
    text-align: end;  /* Aligns right in LTR, left in RTL */
  }
  
  input {
    flex: 1;
    min-width: 150px;
  }
</style>
```

### Pattern 2: Cards with Numbers

```html
<div class="card">
  <h3>Invoice #<span class="number">12345</span></h3>
  <p>Amount: <span class="price">1,500 SAR</span></p>
</div>

<style>
  /* Numbers always stay LTR */
  .number,
  .price {
    direction: ltr;
    unicode-bidi: isolate;
    display: inline-block;
    font-weight: 600;
  }
</style>
```

### Pattern 3: Navigation Menu

```html
<nav class="header-nav">
  <ul class="nav-menu">
    <li><a href="/home">Home</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>

<style>
  .nav-menu {
    display: flex;
    list-style: none;
    gap: 24px;
    /* Items automatically arrange: LTR (left→right), RTL (right←left) */
  }
</style>
```

---

## Testing Checklist

- [ ] Switch to Arabic - layout shifts to RTL smoothly
- [ ] Switch to English - layout shifts to LTR smoothly
- [ ] Numbers DON'T flip when inside Arabic text
- [ ] Phone numbers display correctly in both languages
- [ ] Prices display correctly in both languages
- [ ] Form inputs align properly for both directions
- [ ] Buttons and links work in both directions
- [ ] Modals/dialogs stay centered and readable
- [ ] localStorage persists language preference
- [ ] Page reloads with correct language
- [ ] Browser back/forward maintains language
- [ ] Refresh page while on Arabic - stays Arabic

---

## Troubleshooting

### Issue: Numbers still flipping in Arabic

**Solution**: Make sure you're using `wrapNumbersForRTL()` or the `<span class="number">` pattern.

```javascript
// ✅ Correct
const price = langHelper.wrapNumbersForRTL('Price: 1500 SAR');

// ❌ Wrong - missing wrapper
const price = 'Price: 1500 SAR';
```

### Issue: Text not aligning to direction

**Solution**: Use `text-align: start/end` instead of `left/right`.

```css
/* ✅ Correct */
.text { text-align: start; }

/* ❌ Wrong */
.text { text-align: left; }
```

### Issue: Layout not flipping when language changes

**Solution**: Make sure you're setting both `lang` AND `dir` on `<html>`.

```javascript
// ✅ Correct
html.setAttribute('lang', lang);
html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

// ❌ Wrong - missing dir
html.setAttribute('lang', lang);
```

### Issue: localStorage not persisting language

**Solution**: Check if localStorage is enabled. Use `localStorage.getItem(key)` to verify.

```javascript
// ✅ Check localStorage
console.log(localStorage.getItem('app-lang-preference'));
```

---

## Production Checklist

- [ ] `langHelper.js` loaded before other scripts
- [ ] `rtl-styles.css` included in all pages
- [ ] Language switcher present and functional
- [ ] All number/price/phone fields wrapped correctly
- [ ] No hardcoded `text-align: left/right` in CSS
- [ ] No hardcoded `padding-left/right` without fallback
- [ ] Testing on actual Arabic and English content
- [ ] Mobile responsiveness tested in both directions
- [ ] Accessibility testing (screen readers in both langs)
- [ ] Performance: no unnecessary reflows on lang switch

---

## Browser Support

- ✅ Chrome/Edge 88+
- ✅ Firefox 78+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

Unicode directional markers and CSS logical properties have excellent support on modern browsers.

---

## Further Reading

- [MDN: CSS Logical Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties)
- [MDN: HTML dir Attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/dir)
- [Unicode Bidirectional Algorithm](https://www.unicode.org/reports/tr9/)
- [W3C: Structural Markup and Right-to-Left Text](https://www.w3.org/International/questions/qa-html-dir)
