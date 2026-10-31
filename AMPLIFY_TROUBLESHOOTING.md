# AWS Amplify Troubleshooting Guide

## Common Build Errors and Solutions

### ❌ Error: "DATABASE_URL is required"

**Full Error:**
```
Failed to load config file as a TypeScript/JavaScript module. 
Error: DATABASE_URL is required. See server/.env.example.
```

**Cause:** The `DATABASE_URL` environment variable was not set in AWS Amplify before the build started.

**Solution:**

1. **Go to AWS Amplify Console** → Your App → Environment variables
2. **Add the variable:**
   ```
   Key: DATABASE_URL
   Value: postgresql://username:password@host:5432/database?sslmode=require
   ```
3. **Save** and **Redeploy** (click "Redeploy this version")

**Important Notes:**
- The DATABASE_URL is needed at **build time** for Prisma client generation
- Even though the build doesn't connect to the database, Prisma needs a valid format
- The code now provides a fallback build-time URL, but it's better to set the real one

---

### ❌ Error: "npm ci failed" or "Package not found"

**Cause:** Missing dependencies or corrupted cache.

**Solution:**

1. Clear the build cache:
   - AWS Amplify Console → Build settings → Edit
   - Scroll to "Build image settings"
   - Click "Clear cache"
2. Redeploy

---

### ❌ Error: "CORS policy" in browser console

**Full Error:**
```
Access to fetch at 'https://your-app.amplifyapp.com/api/...' 
has been blocked by CORS policy
```

**Cause:** `CORS_ORIGIN` environment variable doesn't match your Amplify URL.

**Solution:**

1. Copy your **exact** Amplify URL (e.g., `https://main.d123abc.amplifyapp.com`)
2. Update `CORS_ORIGIN` in Environment variables:
   ```
   CORS_ORIGIN=https://main.d123abc.amplifyapp.com
   ```
   ⚠️ **Must include `https://` and NO trailing slash**
3. Redeploy

---

### ❌ Error: "Cannot connect to database"

**Error in logs:**
```
Error: P1001: Can't reach database server
```

**Causes & Solutions:**

**If using Neon:**
- ✅ Check connection string format: `postgresql://user:pass@host.neon.tech/dbname?sslmode=require`
- ✅ Ensure `?sslmode=require` is at the end
- ✅ Verify the database is not paused (Neon free tier auto-pauses)

**If using AWS RDS:**
- ✅ Check Security Group allows inbound connections
- ✅ Make database publicly accessible (for initial testing)
- ✅ Verify VPC and subnet settings

---

### ❌ Error: "Frontend build failed"

**Error:**
```
vite build failed with exit code 1
```

**Common Causes:**

1. **TypeScript errors:**
   - Run `npm run lint` locally to check
   - Fix TypeScript errors before pushing

2. **Missing dependencies:**
   - Ensure `package-lock.json` is committed
   - Check if all dependencies are listed in `package.json`

3. **Environment variable issues:**
   - Vite requires `VITE_` prefix for client-side variables
   - Check `vite.config.ts` for required variables

---

### ❌ Error: "Module not found" at runtime

**Cause:** Build succeeded but app crashes when running.

**Solutions:**

1. **Check Node version:**
   - Amplify should detect `.node-version` (22)
   - Verify in build settings: Node version = 22

2. **Missing production dependencies:**
   - Check `dependencies` vs `devDependencies` in `package.json`
   - Move build-required packages to `dependencies`

---

### ❌ Error: "502 Bad Gateway" or "Application timeout"

**Cause:** Server not starting or taking too long.

**Solutions:**

1. **Check CloudWatch Logs:**
   - Amplify Console → Logs → View logs
   - Look for startup errors

2. **Verify PORT environment variable:**
   - Amplify sets `PORT` automatically
   - Your app should use `process.env.PORT || 3001`

3. **Database connection:**
   - Ensure DATABASE_URL is correct
   - Check if migrations ran successfully

---

## Environment Variable Checklist

Before deploying, ensure you have:

**Required:**
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN` - Your app URL (update after first deploy)
- [ ] `TRUST_PROXY_HOPS=1`

**Optional but recommended:**
- [ ] `USE_CLAUDE_STUB=false` (or true if no Anthropic key)
- [ ] `ANTHROPIC_API_KEY` - For AI features
- [ ] `ANTHROPIC_MODEL` - Claude model name

---

## How to View Logs

1. **Build Logs:**
   - Amplify Console → Your app → Click on build
   - View full build output

2. **Runtime Logs:**
   - Amplify Console → Monitoring → Logs
   - Or AWS CloudWatch → Log groups → `/aws/amplify/...`

3. **Real-time Logs:**
   ```bash
   aws logs tail /aws/amplify/APP_ID/BRANCH --follow
   ```

---

## Step-by-Step Debugging

1. **Check build succeeds:**
   ```bash
   # Locally test build
   npm run build:all
   ```

2. **Test production mode locally:**
   ```bash
   # With real DATABASE_URL
   DATABASE_URL="postgresql://..." npm run start:production
   ```

3. **Verify environment variables:**
   - Amplify Console → Environment variables
   - Check all required variables are set
   - No typos in variable names

4. **Clear cache and redeploy:**
   - Build settings → Clear cache
   - Redeploy

5. **Check database connectivity:**
   ```bash
   # Test connection from your machine
   psql "postgresql://user:pass@host:5432/db"
   ```

---

## Still Having Issues?

1. **Enable verbose logging:**
   Add to `amplify.yml` under backend build commands:
   ```yaml
   - export DEBUG=*
   ```

2. **Check AWS Amplify service status:**
   - https://status.aws.amazon.com/

3. **Review recent changes:**
   - Compare working vs failing commits
   - Check if new dependencies were added

4. **Reach out for help with:**
   - Full build logs
   - Environment variable list (without values)
   - Database provider and region
   - Error messages from CloudWatch

---

## Quick Fixes Summary

| Error | Quick Fix |
|-------|-----------|
| DATABASE_URL required | Set in Environment variables → Redeploy |
| CORS error | Update CORS_ORIGIN to exact Amplify URL |
| Build cache issues | Clear cache → Redeploy |
| Database connection | Check connection string format + ?sslmode=require |
| 502 errors | Check CloudWatch logs for startup errors |
| Missing modules | Verify dependencies in package.json |

---

## Successful Build Checklist

✅ Build completes without errors
✅ Backend and frontend both build
✅ App is accessible at Amplify URL
✅ Can sign up for an account
✅ Can create a group
✅ Can add expenses
✅ Data persists after refresh
✅ No CORS errors in browser console
