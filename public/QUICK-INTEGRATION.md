# Quick Integration Guide - RTL/LTR Setup

## Files Created

1. **[langHelper.js](/lib/langHelper.js)** - Language/direction management library
2. **[rtl-styles.css](/public/rtl-styles.css)** - CSS for bidirectional layouts
3. **[RTL-SETUP-GUIDE.md](/public/RTL-SETUP-GUIDE.md)** - Complete technical documentation
4. **[example-dashboard-rtl.html](/admin/example-dashboard-rtl.html)** - Admin dashboard example
5. **[example-website-rtl.html](/public/example-website-rtl.html)** - Public website example

---

## 30-Second Integration

### 1. Add to HTML `<head>`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    
    <!-- Add this -->
    <link rel="stylesheet" href="/rtl-styles.css">
</head>
<body>
    <!-- Your content -->
    
    <!-- Add this before </body> -->
    <script src="/langHelper.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            langHelper.initializeLanguage();
        });
    </script>
</body>
</html>
```

### 2. Add Language Switcher Anywhere

```html
<div id="lang-switcher"></div>

<script>
// After page loads:
document.getElementById('lang-switcher').innerHTML = 
    langHelper.createLanguageSwitcher();
langHelper.attachLanguageSwitcherListeners('#lang-switcher');
</script>
```

### 3. Use Logical CSS Properties

```css
/* ✅ Good - Respects direction */
.sidebar {
    padding-inline-start: 24px;  /* Logical */
    text-align: start;            /* Logical */
}

/* ❌ Avoid - Hardcoded */
.sidebar {
    padding-left: 24px;  /* Physical */
    text-align: left;    /* Physical */
}
```

### 4. Wrap Numbers (If Needed)

```javascript
// For dynamic content with numbers
const processedText = langHelper.wrapNumbersForRTL('Price: 1500 SAR');
element.innerHTML = processedText;
```

---

## API Reference

### Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `initializeLanguage()` | Restore saved language or detect browser | `langHelper.initializeLanguage()` |
| `setLanguage(lang)` | Switch language ('en' or 'ar') | `langHelper.setLanguage('ar')` |
| `getCurrentLanguage()` | Get current language code | `const lang = langHelper.getCurrentLanguage()` |
| `getCurrentDirection()` | Get current direction ('ltr' or 'rtl') | `const dir = langHelper.getCurrentDirection()` |
| `isRTL()` | Check if Arabic (RTL) | `if (langHelper.isRTL()) { ... }` |
| `wrapNumbersForRTL(text)` | Wrap numbers with directional markers | `text = langHelper.wrapNumbersForRTL(text)` |
| `setDirectionalText(element, text)` | Safe text setting for mixed content | `langHelper.setDirectionalText(el, 'Price: 500')` |
| `createLanguageSwitcher()` | Get HTML for switcher buttons | `html = langHelper.createLanguageSwitcher()` |
| `attachLanguageSwitcherListeners(selector)` | Attach click handlers to switcher | `langHelper.attachLanguageSwitcherListeners()` |

### Events

```javascript
// Listen to language changes
document.addEventListener('languageChanged', (e) => {
    const { lang, dir } = e.detail;
    console.log(`Language: ${lang}, Direction: ${dir}`);
});
```

---

## CSS Utilities

### Logical Properties Equivalents

```css
/* Padding/Margin */
.element {
    padding-inline-start: 24px;  /* = padding-left in LTR, padding-right in RTL */
    padding-inline-end: 24px;    /* = padding-right in LTR, padding-left in RTL */
    margin-inline-start: 12px;   /* = margin-left in LTR, margin-right in RTL */
}

/* Text Alignment */
.text {
    text-align: start;  /* = text-align: left in LTR, right in RTL */
    text-align: end;    /* = text-align: right in LTR, left in RTL */
}

/* Borders */
.border {
    border-inline-start: 2px solid #000;  /* = left border in LTR, right in RTL */
}

/* Sizing */
.box {
    padding-inline: 24px;  /* = padding-left and padding-right or vice versa */
}
```

### Pre-made Utility Classes

```html
<!-- Text alignment -->
<p class="text-start">Aligns to start of direction</p>
<p class="text-end">Aligns to end of direction</p>
<p class="text-center">Always centered</p>

<!-- Force specific direction (override) -->
<span class="force-ltr">Always LTR (prices, IDs)</span>
<span class="force-rtl">Always RTL</span>

<!-- Auto-pushing with margins -->
<div class="ms-auto">Pushed to right in LTR, left in RTL</div>
```

---

## Common Patterns

### Pattern 1: Table with Numbers

```html
<table>
    <tr>
        <td>Item Name</td>
        <td class="number">Price: 1500</td>
    </tr>
</table>

<style>
    td.number {
        direction: ltr;
        unicode-bidi: isolate;
        text-align: right;
    }
</style>
```

### Pattern 2: Form with Bilingual Labels

```html
<form>
    <div class="form-group">
        <label>Phone:</label>
        <input type="tel">  <!-- Automatically LTR -->
    </div>
    
    <div class="form-group">
        <label>Message:</label>
        <textarea dir="inherit"></textarea>  <!-- Respects language -->
    </div>
</form>

<style>
    form {
        direction: inherit;  /* Gets dir from <html> */
    }
</style>
```

### Pattern 3: Dynamic Prices from API

```javascript
// Assume API returns: { price: 1500 }
const response = await fetch('/api/product');
const data = await response.json();

// Wrap numbers automatically
const displayPrice = langHelper.wrapNumbersForRTL(`${data.price} SAR`);
document.querySelector('#price').innerHTML = displayPrice;
```

---

## Testing Checklist

Before deploying to production:

- [ ] Switch language - layout flips smoothly
- [ ] Numbers stay readable in Arabic text
- [ ] Phone numbers don't flip
- [ ] Prices display correctly
- [ ] Forms align properly for both directions
- [ ] Buttons work in both directions
- [ ] Mobile responsive in both RTL and LTR
- [ ] Browser back/forward preserves language
- [ ] Page reload keeps selected language
- [ ] localStorage works (check browser DevTools)

---

## Troubleshooting

### Debug Current State

```javascript
// Check what's happening
console.log('Language:', langHelper.getCurrentLanguage());
console.log('Direction:', langHelper.getCurrentDirection());
console.log('Is RTL?', langHelper.isRTL());
console.log('HTML lang:', document.documentElement.lang);
console.log('HTML dir:', document.documentElement.dir);
console.log('Saved pref:', localStorage.getItem('app-lang-preference'));
```

### Reset Everything

```javascript
// Force language and clear cache
localStorage.removeItem('app-lang-preference');
langHelper.setLanguage('en'); // Start fresh
location.reload();
```

### Common Mistakes

❌ **Using physical properties instead of logical:**
```css
.box { padding-left: 24px; }  ← Breaks in RTL
```

✅ **Use logical properties:**
```css
.box { padding-inline-start: 24px; }  ← Works in both
```

---

❌ **Setting dir on nested elements:**
```html
<html dir="rtl">
  <body dir="rtl">
    <div dir="rtl">  ← Redundant and dangerous
```

✅ **Set dir only on html:**
```html
<html dir="rtl">
  <body>
    <div>  ← Inherits automatically
```

---

❌ **Hardcoding text-align:**
```css
.text { text-align: left; }  ← Always left, broken in RTL
```

✅ **Use logical values:**
```css
.text { text-align: start; }  ← Automatic left/right based on dir
```

---

## Next Steps

1. **Review** [RTL-SETUP-GUIDE.md](/public/RTL-SETUP-GUIDE.md) for deep dive
2. **Check** the example files:
   - [example-dashboard-rtl.html](/admin/example-dashboard-rtl.html)
   - [example-website-rtl.html](/public/example-website-rtl.html)
3. **Test** by opening examples in browser
4. **Integrate** langHelper.js and rtl-styles.css into your existing pages
5. **Apply** patterns to your components

---

## Support

For specific implementation questions:
- Review the examples
- Check the full guide (RTL-SETUP-GUIDE.md)
- Inspect browser DevTools: `langHelper` object is globally available

