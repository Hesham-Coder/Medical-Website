# Railway → Vercel Migration Guide

## Overview
This guide walks you through migrating from Railway to Vercel with **zero data loss** and **full functionality**.

## ⚠️ Critical Changes for Vercel

### 1. **Filesystem Storage → Cloud Storage**
- **Problem**: Vercel's serverless functions have ephemeral filesystems (lost on redeeploy)
- **Solution**: Migrate to AWS S3 or Cloudinary
- **Status**: Data preserved on Railway during testing

### 2. **Redis Session Store → Upstash Redis**
- **Problem**: Vercel has no native Redis
- **Solution**: Use Upstash (free tier available)
- **Status**: Works identically to current setup

### 3. **Local Database (JSON) → PostgreSQL**
- **Problem**: JSON files lost on redeeploy
- **Solution**: Use Vercel Postgres or external PostgreSQL
- **Status**: Full data persistence

---

## Step-by-Step Migration

### STEP 1: Back Up Current Data (Railway)
```bash
# SSH into Railway
railway run bash

# Create backup
npm run backup

# Download backup
railway download backups/backup-*.zip
```

**Status**: ✅ SAFE - Railway still running

---

### STEP 2: Set Up External Services

#### A. PostgreSQL Database

**Option 1: Vercel Postgres (Recommended)**
1. Go to: https://vercel.com/docs/storage/vercel-postgres
2. Click "Create Database" in project settings
3. Copy connection string → `.env.vercel`

**Option 2: Supabase (Free PostgreSQL)**
1. Go to: https://supabase.com
2. Create new project
3. Copy connection string → `.env.vercel`

**Schema Setup**:
```sql
-- Run in your database:
CREATE TABLE IF NOT EXISTS data (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255),
  url TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### B. Redis Session Store

**Upstash (Recommended)**
1. Go to: https://console.upstash.com
2. Create new Redis database
3. Copy `REDIS_URL` → `.env.vercel`

**Pricing**: Free tier = 10K commands/day (plenty for sessions)

#### C. File Storage

**Option 1: Cloudinary (Easiest)**
1. Sign up: https://cloudinary.com
2. Copy credentials → `.env.vercel`
3. No additional setup needed

**Option 2: AWS S3**
1. Create S3 bucket
2. Create IAM user with S3 access
3. Copy credentials → `.env.vercel`
4. More control, but requires setup

---

### STEP 3: Update Code for Cloud Storage

**Files to create/modify:**
- `lib/storageAdapter.js` - Abstraction for S3/Cloudinary
- `lib/databaseAdapter.js` - PostgreSQL instead of JSON files
- `lib/sessionStore.js` - Use Upstash Redis

**Status**: Will be implemented in next commit

---

### STEP 4: Test Locally

```bash
# Copy template to .env.local
cp .env.vercel .env.local

# Add your actual credentials
vim .env.local

# Install Vercel CLI
npm install -g vercel

# Test locally with Vercel environment
vercel dev

# Visit http://localhost:3000
```

**Test Checklist:**
- ✅ Homepage loads
- ✅ Login works
- ✅ Upload image
- ✅ Create/edit post
- ✅ Session persists
- ✅ Logout works

---

### STEP 5: Deploy to Vercel

```bash
# 1. Push this branch to GitHub
git push origin vercel-migration

# 2. Create GitHub App in Vercel
# https://vercel.com/new/git/connect?repository-url=https://github.com/Hesham-Coder/Medical-Website&project-name=medical-website

# 3. Select "vercel-migration" branch

# 4. Add Environment Variables in Vercel Dashboard:
#    - POSTGRES_URL
#    - REDIS_URL
#    - S3_BUCKET / CLOUDINARY_CLOUD_NAME
#    - SESSION_SECRET
#    - All others from .env.vercel

# 5. Click Deploy

# 6. Wait for build to complete (~2-3 min)
```

**Vercel Dashboard**: https://vercel.com/dashboard

---

### STEP 6: Production Validation

**Test on Vercel Preview URL:**
- [ ] Homepage renders
- [ ] API endpoints respond
- [ ] Login works
- [ ] File uploads work
- [ ] Session persists across requests
- [ ] Admin dashboard accessible
- [ ] No 500 errors in logs

**Check Logs:**
```bash
vercel logs --tail
```

---

### STEP 7: Data Migration

**Option A: Keep Railway Running (Recommended)**
- Run Vercel in parallel with Railway for 1-2 weeks
- If issues arise, rollback DNS to Railway
- Zero downtime testing

**Option B: One-Time Migration**
- Export data from Railway backup
- Import into PostgreSQL
- Redirect traffic to Vercel
- Delete Railway instance

---

### STEP 8: Switch DNS to Vercel

**Only after production validation:**

1. Get Vercel domain:
   ```
   medical-website.vercel.app
   ```

2. Update DNS settings (domain registrar):
   ```
   CNAME waleedarafat.org → cname.vercel-dns.com
   ```

3. Wait for DNS propagation (~5-30 min)

4. Verify:
   ```bash
   dig waleedarafat.org
   curl https://waleedarafat.org
   ```

---

## Environment Variables Checklist

| Variable | Source | Vercel Type | Notes |
|----------|--------|-------------|-------|
| `NODE_ENV` | Manual | Public | Always `production` |
| `SITE_URL` | Manual | Public | Your domain |
| `SESSION_SECRET` | Generate | Secret | Min 32 chars, use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `POSTGRES_URL` | Vercel Postgres | Secret | Connection string |
| `REDIS_URL` | Upstash | Secret | Connection string |
| `S3_BUCKET` | AWS | Public | Bucket name |
| `AWS_ACCESS_KEY_ID` | AWS | Secret | |
| `AWS_SECRET_ACCESS_KEY` | AWS | Secret | |
| `ADMIN_BOOTSTRAP_USERNAME` | Manual | Public | |
| `ADMIN_BOOTSTRAP_PASSWORD` | Manual | Secret | Change this! |

---

## Troubleshooting

### "Cannot find module 'postgresql'"
→ PostgreSQL driver not installed: `npm install pg`

### "Redis connection timeout"
→ Check `REDIS_URL` in Vercel dashboard
→ Verify Upstash IP whitelist (allow all for now)

### "File upload returns 404"
→ Check S3/Cloudinary credentials
→ Verify bucket exists and is public

### "Sessions not persisting"
→ Check Redis connection
→ Verify `SESSION_SECRET` is 32+ chars

### "Build fails: 'data' directory not found"
→ This is expected - code uses PostgreSQL now
→ Check build logs for actual errors

---

## Rollback Plan (If Needed)

**If Vercel deployment fails:**

1. Railway is still running (untouched)
2. Update DNS back to Railway
3. Delete Vercel deployment
4. No data loss

```bash
# Delete Vercel project
vercel remove --yes

# DNS reverts to Railway
```

---

## Next Steps

1. ✅ Backup Railway data
2. ⏳ Set up Postgres + Redis + Storage
3. ⏳ Update code (lib/storageAdapter.js)
4. ⏳ Test locally
5. ⏳ Deploy to Vercel
6. ⏳ Validate production
7. ⏳ Switch DNS
8. ⏳ Monitor for 48 hours
9. ⏳ Delete Railway (after confirmation)

---

## Cost Estimate

| Service | Free Tier | Production | Notes |
|---------|-----------|------------|-------|
| Vercel | $0 | ~$20/mo | Serverless compute |
| Vercel Postgres | 0.25M queries/mo | $15/mo | Or use Supabase free |
| Upstash Redis | 10K cmds/day | $7/mo | Plenty for sessions |
| S3/Cloudinary | Varies | $5-20/mo | File storage |
| **Total** | **~$0** | **~$47/mo** | Down from Railway $12/mo |

*Note: Exact costs depend on usage. Most of above can be replaced with free tiers.*

---

## Questions?

Refer to Vercel docs: https://vercel.com/docs
