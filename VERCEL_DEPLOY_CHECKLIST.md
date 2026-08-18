# DEPLOYMENT TO VERCEL - STEP-BY-STEP

## CURRENT STATUS
✅ Code ready for Vercel  
✅ Configuration files created  
✅ Adapters for cloud storage/database implemented  
⏳ **NEXT: Set up external services**

---

## STEP 1: Set Up External Services (5-10 min)

### 1A. PostgreSQL Database

**Choose ONE:**

#### Option 1: Vercel Postgres (Recommended)
```
1. Go to: https://vercel.com/docs/storage/vercel-postgres
2. In your Vercel dashboard, click "Add Database"
3. Select "Create New Postgres Database"
4. Copy the connection string
5. Save as POSTGRES_URL in .env.vercel
```

**Cost**: $5-15/month (pay as you go)

#### Option 2: Supabase (Free)
```
1. Go to: https://supabase.com
2. Create new project
3. Copy PostgreSQL connection string
4. Save as POSTGRES_URL in .env.vercel
```

**Cost**: Free tier available

---

### 1B. Redis Session Store

**Setup Upstash Redis:**
```
1. Go to: https://console.upstash.com
2. Click "Create Database"
3. Name: medical-website
4. Region: Pick closest to your users
5. Copy REST API URL
6. Format: redis://default:PASSWORD@HOST:PORT
7. Save as REDIS_URL in .env.vercel
```

**Cost**: Free tier = 10,000 commands/day (plenty for sessions)

---

### 1C. File Storage

**Choose ONE:**

#### Option 1: Cloudinary (Easiest)
```
1. Sign up: https://cloudinary.com (free tier: 25GB)
2. Dashboard → API Keys
3. Copy:
   - Cloud Name
   - API Key
   - API Secret
4. Add to .env.vercel as:
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
```

**Cost**: Free tier = 25GB/month

#### Option 2: AWS S3
```
1. AWS Console → S3
2. Create bucket: medical-website-uploads
3. Create IAM user with S3 access
4. Copy credentials:
   - Access Key ID
   - Secret Access Key
5. Add to .env.vercel:
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   S3_BUCKET=medical-website-uploads
   AWS_REGION=us-east-1
```

**Cost**: Pay per usage (~$0.023/GB)

---

## STEP 2: Generate SESSION_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output example:
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0

# Copy this and add to .env.vercel
```

---

## STEP 3: Create Vercel Project

### Option A: Via GitHub (Recommended)

```bash
# 1. Push branch to GitHub
git push origin vercel-migration

# 2. Go to Vercel
https://vercel.com/new/git

# 3. Click "Import Project"

# 4. Select GitHub repo: Hesham-Coder/Medical-Website

# 5. Select branch: vercel-migration

# 6. Framework: Other (Node.js Express)

# 7. Click "Configure Project"
```

### Option B: CLI

```bash
npm install -g vercel
vercel login
vercel link
vercel deploy
```

---

## STEP 4: Add Environment Variables to Vercel Dashboard

```
Vercel Dashboard → Settings → Environment Variables

Add all from .env.vercel:

✅ PUBLIC (can be seen in browser):
  - NODE_ENV = production
  - SITE_URL = https://www.waleedarafat.org
  - S3_BUCKET = medical-website-uploads (if using S3)
  - CLOUDINARY_CLOUD_NAME = (if using Cloudinary)

🔐 SECRET (hidden):
  - SESSION_SECRET = <your generated secret>
  - POSTGRES_URL = postgresql://...
  - POSTGRES_URL_NON_POOLING = postgresql://...
  - REDIS_URL = redis://...
  - AWS_ACCESS_KEY_ID = (if using S3)
  - AWS_SECRET_ACCESS_KEY = (if using S3)
  - CLOUDINARY_API_KEY = (if using Cloudinary)
  - CLOUDINARY_API_SECRET = (if using Cloudinary)
  - ADMIN_BOOTSTRAP_PASSWORD = change-this-password
```

---

## STEP 5: Configure Build Settings

**In Vercel Dashboard → Project Settings:**

```
Build & Development Settings:

Framework Preset: Other

Build Command:
  npm run build

Output Directory:
  (leave empty - Vercel uses /api and static files)

Install Command:
  npm install

Node.js Version:
  18.x (LTS)
```

---

## STEP 6: Deploy

**Click Deploy button in Vercel Dashboard**

Wait for:
```
✅ Installing dependencies (~1 min)
✅ Running build command (~2 min)
✅ Uploading deployment (~30 sec)
✅ Deployment complete
```

You'll see:
```
Production: ✅ Ready
URL: https://medical-website-xyz.vercel.app
```

---

## STEP 7: Test Deployment

### Test URLs

```
# Your deployment
https://medical-website-xyz.vercel.app

# Health check
https://medical-website-xyz.vercel.app/health

# Homepage
https://medical-website-xyz.vercel.app/

# Login
https://medical-website-xyz.vercel.app/login.html

# Admin (needs login)
https://medical-website-xyz.vercel.app/dashboard.html
```

### Test Checklist

- [ ] Homepage loads (no 500 error)
- [ ] CSS/JS loaded correctly
- [ ] API responds: `/api/auth/check`
- [ ] Login page loads
- [ ] Can login with admin credentials
- [ ] Can view admin dashboard
- [ ] No console errors
- [ ] Check Vercel logs: `vercel logs --tail`

### Check Logs

```bash
vercel logs --tail

# Look for errors like:
# - DATABASE_URL not set
# - Redis connection failed
# - Storage credentials missing
```

---

## STEP 8: Troubleshooting

### Error: "Cannot find module 'pg'"
→ Run: `npm install pg`  
→ Push to GitHub  
→ Vercel redeploys automatically

### Error: "POSTGRES_URL is not defined"
→ Check Vercel Environment Variables  
→ Verify SECRET variables are set  
→ Restart deployment: Redeploy button

### Error: "Redis connection timeout"
→ Check REDIS_URL format  
→ Verify Upstash IP whitelist (allow 0.0.0.0/0 for testing)  
→ Test locally first: `vercel dev`

### Error: "File upload returns 404"
→ Verify S3/Cloudinary credentials  
→ Check bucket permissions  
→ Test with small file (< 1MB)

### Cannot access /uploads or /admin files
→ This is expected - Vercel doesn't have persistent filesystem  
→ Files are served via API now  
→ Check if routes use `/api/storage/uploads?path=...`

---

## STEP 9: Switch DNS (After Validation)

**⚠️ ONLY DO THIS AFTER VERCEL WORKS PERFECTLY**

```
1. Your domain registrar (GoDaddy, Namecheap, etc.)

2. DNS Settings → Update CNAME record
   From: waleedarafat.org → Railway
   To:   waleedarafat.org → cname.vercel-dns.com

3. DNS propagation: 5-30 minutes

4. Verify:
   curl https://waleedarafat.org/health
   # Should show: {"status":"ok"...}

5. Test all features again on production domain
```

---

## STEP 10: Keep Railway Running (Backup)

**Do NOT delete Railway yet**

Run parallel for 1-2 weeks:
- Monitor Vercel for errors
- If critical issues → roll back DNS to Railway
- Zero downtime

After 2 weeks of stability:
```bash
railway run bash
rm -rf /var/data/app-data  # Backup first!
railway down  # Stop the app
# Then delete from Railway dashboard
```

---

## FINAL CHECKLIST

- [ ] PostgreSQL database created and connected
- [ ] Redis (Upstash) created and connected
- [ ] File storage (S3/Cloudinary) configured
- [ ] SESSION_SECRET generated (32+ chars)
- [ ] Environment variables added to Vercel
- [ ] Vercel project created from `vercel-migration` branch
- [ ] Build successful (no errors)
- [ ] Homepage loads
- [ ] Login works
- [ ] Admin dashboard accessible
- [ ] File upload works
- [ ] Logs checked for errors
- [ ] DNS NOT changed yet (still on Railway)
- [ ] Railway still running as backup

---

## COSTS SUMMARY

| Service | Free Tier | Production | Link |
|---------|-----------|-----------|------|
| **Vercel** | ✅ Included | ~$20/mo | https://vercel.com/pricing |
| **Vercel Postgres** | ❌ 0.25M queries/mo only | ~$15/mo | https://vercel.com/docs/storage |
| **Supabase** (alt) | ✅ 500MB free | ~$10-25/mo | https://supabase.com/pricing |
| **Upstash Redis** | ✅ 10K cmds/day | ~$7/mo | https://upstash.com/pricing |
| **Cloudinary** | ✅ 25GB/mo free | ~$10-20/mo | https://cloudinary.com/pricing |
| **AWS S3** | ❌ 1 year free | ~$0.023/GB | https://aws.amazon.com/s3/pricing |
| **Total** | **~$0** | **~$52/mo** | |

*Note: Can use free tiers for testing → pay only for production usage*

---

## Questions?

**Vercel Docs**: https://vercel.com/docs  
**Upstash Docs**: https://upstash.com/docs  
**Vercel Postgres**: https://vercel.com/docs/storage/vercel-postgres  
**Cloudinary Docs**: https://cloudinary.com/documentation

---

## Next Command

```bash
# When ready to deploy:
git push origin vercel-migration

# Then go to: https://vercel.com/new/git
```
