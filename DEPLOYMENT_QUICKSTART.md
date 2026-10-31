# 🚀 AWS Amplify - Quick Deployment Guide

## Prerequisites ✅
- [ ] GitHub repository with this code
- [ ] AWS Account
- [ ] PostgreSQL database (Neon recommended)

## 5-Minute Setup

### 1️⃣ Get Database (Choose One)

**Option A: Neon (Recommended - Free)**
1. Go to https://neon.tech
2. Sign up → Create project → Copy connection string
3. Format: `postgresql://user:pass@host.neon.tech/dbname?sslmode=require`

**Option B: AWS RDS**
1. RDS Console → Create database → PostgreSQL
2. Free tier available (db.t3.micro)
3. Note connection details

### 2️⃣ Deploy to Amplify

1. **Go to:** https://console.aws.amazon.com/amplify/
2. **Click:** "New app" → "Host web app"
3. **Connect:** Your GitHub repository
4. **Select:** This repo + main branch
5. **Build settings:** Should auto-detect `amplify.yml` ✓

### 3️⃣ Set Environment Variables **BEFORE FIRST DEPLOY**

⚠️ **CRITICAL**: Set these BEFORE clicking deploy!

In Amplify Console → Environment variables → Add:

```bash
# REQUIRED - Set this first!
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# Set placeholder, update after deploy
CORS_ORIGIN=https://placeholder.amplifyapp.com

# Other required variables
NODE_ENV=production
TRUST_PROXY_HOPS=1
USE_CLAUDE_STUB=false

# OPTIONAL (AI Features)
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

**⚠️ Important:** Leave `CORS_ORIGIN` with placeholder first. You'll update it in step 5.

### 4️⃣ Deploy

Click **"Save and deploy"**

⏳ First build takes ~5-10 minutes

### 5️⃣ Update CORS After Deploy

1. **Copy** your Amplify URL (e.g., `https://main.d123abc.amplifyapp.com`)
2. **Update** `CORS_ORIGIN` environment variable with actual URL
3. **Redeploy** (click "Redeploy this version")

### 6️⃣ Run Database Migration

**Option A: From your machine:**
```bash
DATABASE_URL="postgresql://..." npm --prefix server run db:migrate
```

**Option B: Via Amplify build (add to amplify.yml):**
Add under `backend.phases.build.commands`:
```yaml
- npm --prefix server run db:migrate
```

### 7️⃣ Test Your App! 🎉

Visit your Amplify URL and:
- [ ] Sign up for an account
- [ ] Create a group
- [ ] Add an expense
- [ ] Check balances

---

## Troubleshooting 🔧

### Build Fails
- ✅ Check Node version is 22 (`.node-version` file)
- ✅ Verify all environment variables are set
- ✅ Check build logs in Amplify console

### Can't Connect to API
- ✅ Verify `CORS_ORIGIN` matches your Amplify URL **exactly**
- ✅ Include `https://` in CORS_ORIGIN
- ✅ No trailing slash in CORS_ORIGIN

### Database Errors
- ✅ Verify `DATABASE_URL` format is correct
- ✅ Check database allows connections from Amplify IPs
- ✅ Ensure migrations ran successfully

### 500 Errors
- ✅ Check CloudWatch Logs in Amplify console
- ✅ Verify `NODE_ENV=production`
- ✅ Check database connection string

---

## Architecture

```
┌─────────────────────┐
│   AWS Amplify       │  ← You are here
│   Full-stack app    │
│   (Frontend + API)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   PostgreSQL        │
│   (Neon / RDS)      │
└─────────────────────┘
```

---

## Cost 💰

- **Amplify**: Free tier → 1000 build mins/month + 15GB served
- **Neon DB**: Free tier → 512MB storage + 100hrs compute
- **Total**: **$0/month** on free tiers!

---

## Need More Help?

📚 See full guide: [AMPLIFY_DEPLOYMENT.md](./AMPLIFY_DEPLOYMENT.md)

---

## Alternative: Split Frontend & Backend

For production scale, deploy separately:

**Frontend:** AWS Amplify (this repo)
**Backend:** AWS App Runner (using `server/Dockerfile`)

See AMPLIFY_DEPLOYMENT.md for instructions.
