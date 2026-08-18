# DO THIS NOW - Vercel 500 Error Fix

## 🔴 Problem
```
500: INTERNAL_SERVER_ERROR
FUNCTION_INVOCATION_FAILED
```

## 🟢 Solution (5 minutes)

### Step 1: Generate SECRET
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy output.

### Step 2: Add to Vercel
```
https://vercel.com/dashboard
→ Your Project
→ Settings
→ Environment Variables

Add:
NODE_ENV = production
SITE_URL = https://www.waleedarafat.org
SESSION_SECRET = <paste from Step 1>

Click: Save
```

### Step 3: Redeploy
```
Vercel Dashboard
→ Deployments
→ Latest
→ Redeploy button

Wait for: ✅ Success
```

### Step 4: Test
```bash
curl https://your-vercel-url.vercel.app/health
```

Should return:
```json
{"status":"ok","timestamp":"...","uptime":...}
```

## ✅ Fixed!

If you see that JSON → It works now.

---

## Next: External Services (Optional)

For full functionality, add later:
- **PostgreSQL** → Vercel Postgres or Supabase
- **Redis** → Upstash
- **Storage** → Cloudinary or S3

But the app works without them (with limitations).

---

## Still broken?

```bash
vercel logs --tail
```

Share the error output.
