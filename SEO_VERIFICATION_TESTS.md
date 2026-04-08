# SEO Verification Tests

## Quick Verification Checklist

After deploying the SEO injection code, run these tests to verify everything works:

---

## Test 1: Check Raw HTML (Command Line)

### Verify Title is Injected
```bash
# Test English
curl -s https://yoursite.com/ | grep "<title>"
# Expected: <title>Science That Heals...

# Test Arabic  
curl -s https://yoursite.com/?lang=ar | grep "<title>"
# Expected: <title>رعايتك تبدأ...
```

### Verify Meta Description is Injected
```bash
curl -s https://yoursite.com/ | grep 'name="description"'
# Expected: <meta name="description" content="Our multidisciplinary oncology team...">
```

### Verify Open Graph Tags
```bash
curl -s https://yoursite.com/ | grep 'property="og:'
# Expected multiple results:
# <meta property="og:title" content="...">
# <meta property="og:description" content="...">
# <meta property="og:image" content="...">
# <meta property="og:url" content="...">
```

### Simulate Googlebot
```bash
curl -s -H "User-Agent: Googlebot" https://yoursite.com/ | grep -E "<title>|og:title|og:description|og:image"
# All tags should appear as injected
```

---

## Test 2: Google Search Console (Best for Verification)

### Step-by-Step
1. Go to: https://search.google.com/search-console
2. Select your property
3. Click **URL Inspection** (left sidebar)
4. Enter URL: `https://yoursite.com/`
5. Click **Test live URL**

### What to Look For
```
Google Cache View:
✅ Title displays: "Science That Heals. Care That Connects. | Comprehensive Cancer Center"
✅ Meta description shows: "Our multidisciplinary oncology team..."
✅ Snippets preview shows correct content
✅ Mobile vs Desktop both show correct content
```

### Rich Results
1. Still in URL Inspection
2. Look for **"Enhancements"** section
3. Check if Open Graph tags are recognized
4. If issue, click **"Test in Rich Results Tester"**

---

## Test 3: Facebook Sharing Debugger (Visual Preview)

### Step-by-Step
1. Go to: https://developers.facebook.com/tools/debug/sharing/
2. Enter URL: `https://yoursite.com/`
3. Click **Debug**

### What You Should See
```
Card Preview:
┌─────────────────────────────┐
│ [Image from og:image]       │
│                             │
│ Science That Heals. Care    │
│ That Connects.              │
│                             │
│ Our multidisciplinary       │
│ oncology team designs...    │
│                             │
│ www.yoursite.com           │
└─────────────────────────────┘

Metadata:
✅ og:title: "Science That Heals..."
✅ og:description: "Our multidisciplinary oncology team..."
✅ og:image: "https://example.com/uploads/img-...jpg"
✅ og:type: "website"
✅ og:url: "https://example.com/"
```

### If Preview is Missing Image
- Check that `og:image` is a full URL (not relative path)
- Ensure image file exists and is accessible
- Wait 24 hours for Facebook to re-crawl (click "Scrape Again")

---

## Test 4: WhatsApp Link Preview

### Step-by-Step
1. Open WhatsApp
2. Click chat window
3. Paste: `https://yoursite.com/`
4. Watch preview load

### Expected Result
```
Preview appears with:
✅ Heading from og:title
✅ Description from og:description  
✅ Thumbnail image from og:image
```

### Troubleshooting
- If no preview: Check Internet connection
- If generic preview: Wait 24 hours, image file must be accessible
- To test again: Delete link from chat, paste again, wait 5 seconds

---

## Test 5: Twitter Card Preview

### Step-by-Step
1. Go to: https://cards-dev.twitter.com/validator
2. Enter URL: `https://yoursite.com/`
3. Click **Preview Card**

### Expected Result
```
Card Type: Summary Large Image

✅ Title: "Science That Heals. Care That Connects."
✅ Description: "Our multidisciplinary oncology team..."
✅ Image Preview: Shows your og:image
✅ Domain: www.yoursite.com
```

---

## Test 6: LinkedIn Preview (If Applicable)

### Step-by-Step
1. Open LinkedIn
2. Click **Share Update**
3. Paste URL: `https://yoursite.com/`
4. Wait for preview to load

### Expected Result
```
Preview shows:
✅ Title from og:title
✅ Description from og:description
✅ Image from og:image
✅ URL displays correctly
```

---

## Test 7: Browser DevTools Verification

### Chrome DevTools
1. Right-click on page → **Inspect**
2. Go to **Elements** tab
3. Find `<head>` section
4. Verify tags are present:
```html
<head>
  <title>Science That Heals. Care That Connects. | Comprehensive Cancer Center</title>
  <meta name="description" content="...">
  <meta property="og:title" content="...">
  <meta property="og:description" content="...">
  <meta property="og:image" content="...">
  <meta name="twitter:card" content="summary_large_image">
  ...
</head>
```

### Firefox DevTools
1. Right-click → **Inspect Element**
2. Look for `<head>` section
3. Same verification as Chrome

---

## Test 8: Language Detection

### Test English
```bash
curl -H "Accept-Language: en-US" https://yoursite.com/ | grep "<title>"
# Should show English title from content.en
```

### Test Arabic via Header
```bash
curl -H "Accept-Language: ar-EG" https://yoursite.com/ | grep "<title>"
# Should show Arabic title from content.ar
```

### Test Arabic via Query Param
```bash
curl https://yoursite.com/?lang=ar | grep "<title>"
# Should show Arabic content regardless of Accept-Language
```

---

## Test 9: API Endpoint (If Implemented)

### Get SEO Tags (English)
```bash
curl https://yoursite.com/api/seo-tags?lang=en

# Response:
{
  "success": true,
  "language": "en",
  "tags": {
    "title": "Science That Heals. Care That Connects. | Comprehensive Cancer Center",
    "metaDescription": "Our multidisciplinary oncology team...",
    "ogTitle": "Science That Heals. Care That Connects.",
    "ogDescription": "Our multidisciplinary oncology team...",
    "ogImage": "https://example.com/uploads/img-...jpg",
    "ogUrl": "https://example.com/?lang=en",
    "twitterTitle": "Science That Heals. Care That Connects.",
    "twitterDescription": "Our multidisciplinary oncology team..."
  }
}
```

### Get SEO Tags (Arabic)
```bash
curl https://yoursite.com/api/seo-tags?lang=ar

# Response:
{
  "success": true,
  "language": "ar",
  "tags": {
    "title": "رعايتك تبدأ من التشخيص الدقيق | مركز شامل...",
    "metaDescription": "في المركز الطبي المتكامل...",
    ...
  }
}
```

---

## Test 10: Performance Check

### Before SEO Injection (Baseline)
```bash
time curl https://yoursite.com/ > /dev/null

# Expected: ~200-500ms for initial request
```

### After SEO Injection (Should be Similar)
```bash
time curl https://yoursite.com/ > /dev/null

# Expected: ~200-500ms (same or slightly higher)
# If significantly slower, check:
# - readPublishedContent() performance
# - File read performance
# - Database queries
```

### Check Cache is Working
```bash
# First request
curl -H "User-Agent: Googlebot" https://yoursite.com/ -w "Time: %{time_starttransfer}s\n"
# ~300-500ms

# Second request (within cache window)
curl -H "User-Agent: Googlebot" https://yoursite.com/ -w "Time: %{time_starttransfer}s\n"
# ~50-100ms (should be faster due to cache)
```

---

## Test 11: Error Handling

### Test With Invalid Content
1. Manually corrupt `data/content.json` (remove siteInfo)
2. Hit page
3. Should fall back to default SEO tags (not error 500)

### Test With Missing HTML File
1. Rename website/desktop.html temporarily
2. Hit page
3. Should return error gracefully (not crash)

---

## Test 12: Search Results Preview (After Indexing)

### Wait 24-48 Hours Then Check
```bash
# Google Search
site:yoursite.com

# You should see:
✅ Title displays correctly: "Science That Heals..."
✅ Snippet shows description: "Our multidisciplinary oncology team..."
✅ URL displays: yoursite.com
✅ Breadcrumbs if configured

# Bing Search  
site:yoursite.com

# Similar results as Google
```

---

## Common Issues & Fixes

### Issue 1: Title Shows Generic, Not Dynamic

**Check:**
```bash
curl https://yoursite.com/ | grep "<title>"
```

**If Original:**
```html
<title>Comprehensive Cancer Center - Evidence-Based Cancer Care</title>
```

**Should Be:**
```html
<title>Science That Heals. Care That Connects. | Comprehensive Cancer Center</title>
```

**Fix:**
1. Verify `data/content.json` has `siteInfo.heroHeading`
2. Check server logs: `node server.js`
3. Test API: `curl https://yoursite.com/api/seo-tags`

---

### Issue 2: Image Not Showing in Preview

**Check:**
```bash
curl https://yoursite.com/ | grep "og:image"
# Should see: <meta property="og:image" content="https://...jpg">
```

**If Missing or Broken:**
1. Verify image URL is full path (starts with http or /)
2. Check file exists: Visit URL in browser
3. Ensure image is public (accessible)

**Fix:**
- Log in to admin dashboard
- Go to **Images** section
- Re-upload logo/hero image
- Republish changes

---

### Issue 3: Different Content When Sharing

**Check:**
```bash
curl https://yoursite.com/ | grep "og:title"
curl -H "Accept-Language: ar" https://yoursite.com/ | grep "og:title"
```

**If Arabic request shows English:**
1. Check language detection: Add `?lang=ar`
2. Verify Accept-Language header sent
3. Check content has both en and ar versions

---

### Issue 4: Crawlers See Old Content

**Cause:** Cache is stale

**Fix:**
- Option 1: Wait for cache to expire (default 1 hour)
- Option 2: Restart server: `node server.js`
- Option 3: Reduce cache time in code (change `max-age=3600` to `max-age=300`)

---

## Summary Checklist

After deployment, you should verify:

- [ ] Title tag is dynamic (shows hero heading)
- [ ] Meta description is dynamic (shows hero description)
- [ ] og:title is dynamic
- [ ] og:description is dynamic
- [ ] og:image is dynamic (shows logo URL)
- [ ] Twitter tags are populated
- [ ] Google Search Console sees injected content
- [ ] Facebook preview shows image + description
- [ ] WhatsApp shows image + preview
- [ ] Language detection works (?lang=ar)
- [ ] Cache is working (second request faster)
- [ ] No 500 errors in logs
- [ ] Performance is acceptable

---

## Expected Results

### Before Implementation
- ❌ Google sees: "Loading..."
- ❌ Facebook shows generic preview
- ❌ WhatsApp shows no image
- ❌ Low search rankings

### After Implementation  
- ✅ Google sees: "Science That Heals. Care That Connects."
- ✅ Facebook shows: Heading, description, image
- ✅ WhatsApp shows: Rich preview with image
- ✅ Better search visibility within weeks

---

## When to Expect Results

| Timeline | What Happens |
|----------|-------------|
| **Immediately** | Raw HTML shows injected tags |
| **1-24 hours** | Google recrawls page |
| **2-7 days** | Google updates search results |
| **1-2 weeks** | Ranking improvements visible |
| **1 month** | Full SEO impact measurable |

---

## Monitoring

### Set Up Google Search Console Alerts
1. Go to https://search.google.com/search-console
2. Settings → Security & Manual Actions
3. Get notified of crawl errors or manual penalties

### Monitor Rankings
Use free tools:
- Google Search Console (free)
- Bing Webmaster Tools (free)
- Ahrefs Free Backlink Checker
- MozBar Chrome Extension

---

## Questions?

If any test fails:
1. Check server logs: `console.error()` outputs
2. Test API endpoint: `/api/seo-tags?lang=en`
3. Verify database: Check `data/content.json`
4. Check file permissions: Can server read HTML files?
