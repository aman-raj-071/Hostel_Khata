# AWS Amplify Deployment Guide

## Prerequisites
- AWS Account
- GitHub repository with this code
- PostgreSQL database (recommended: AWS RDS PostgreSQL or Neon)

## Step 1: Set up Database

### Option A: AWS RDS PostgreSQL
1. Go to AWS RDS console
2. Create a PostgreSQL database (Free tier available)
3. Note the connection details

### Option B: Neon (Recommended for simplicity)
1. Go to https://neon.tech
2. Create a free PostgreSQL database
3. Copy the connection string

## Step 2: Deploy to AWS Amplify

1. **Connect to AWS Amplify**
   - Go to AWS Amplify Console: https://console.aws.amazon.com/amplify/
   - Click "New app" → "Host web app"
   - Connect your GitHub repository
   - Select this repository and branch

2. **Configure Build Settings**
   - Amplify should auto-detect `amplify.yml`
   - If not, use the following build settings:

3. **Set Environment Variables (IMPORTANT: Do this BEFORE first deploy!)**
   
   Go to "Environment variables" and add:

   **Backend API (server) variables:**
   ```
   # CRITICAL: Set before deploying!
   DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
   
   # Set placeholder first, update after deploy
   CORS_ORIGIN=https://placeholder.amplifyapp.com
   
   # Other required
   PORT=3001
   TRUST_PROXY_HOPS=1
   NODE_ENV=production
   USE_CLAUDE_STUB=false
   ```

   **Frontend variables:**
   ```
   VITE_API_URL=https://your-api-domain.com
   ```

   **Optional (if using Anthropic AI features):**
   ```
   ANTHROPIC_API_KEY=your-anthropic-key
   ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
   ```

4. **Configure Backend API**
   
   Since this is a full-stack app, you have two deployment options:

   ### Option A: Separate API Deployment (Recommended)
   
   Deploy the API separately:
   1. Use AWS Elastic Beanstalk or AWS App Runner for the API
   2. Or use Docker on ECS/Fargate using `server/Dockerfile`
   3. Set `API_ORIGIN` env var in Amplify to your API URL
   
   **Example with AWS App Runner:**
   ```bash
   # In server directory
   docker build -t hostel-khata-api -f Dockerfile ..
   # Push to ECR and deploy via App Runner
   ```

   ### Option B: Monolithic Deployment
   
   Build both frontend and backend together (requires custom setup)

5. **Run Database Migrations**
   
   After first deploy, run migrations:
   ```bash
   # Connect to your database and run:
   npm --prefix server run db:migrate
   ```

   Or set up a custom build command in amplify.yml to run migrations.

## Step 3: Update CORS_ORIGIN

After deployment:
1. Copy your Amplify app URL (e.g., `https://main.d1234567890.amplifyapp.com`)
2. Update the `CORS_ORIGIN` environment variable
3. Redeploy

## Step 4: Test the Deployment

1. Visit your Amplify app URL
2. Try signing up and creating a group
3. Add expenses and verify they persist

## Architecture

```
┌─────────────────────┐
│   AWS Amplify       │
│   (Frontend SSR)    │
│   TanStack Start    │
└──────────┬──────────┘
           │
           │ /api → proxy
           ▼
┌─────────────────────┐
│   API Server        │
│   (Express)         │
│   Port 3001         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   PostgreSQL        │
│   (AWS RDS/Neon)    │
└─────────────────────┘
```

## Troubleshooting

### Build Fails
- Check Node version is 22 (specified in `.node-version`)
- Verify all environment variables are set
- Check build logs in Amplify console

### API Connection Issues
- Verify `CORS_ORIGIN` matches your Amplify URL exactly
- Check `API_ORIGIN` is set correctly
- Ensure backend is running and accessible

### Database Connection Issues
- Verify `DATABASE_URL` format
- Check database security groups allow connections
- For AWS RDS, ensure VPC settings are correct

### Prisma Issues
- Run `npm run db:generate` in server directory
- Run `npm run db:migrate` to apply schema
- Check DATABASE_URL uses PostgreSQL (not SQLite)

## Cost Estimation

- **AWS Amplify**: Free tier includes 1000 build minutes/month, 15GB served/month
- **AWS RDS PostgreSQL**: ~$15-25/month (or use free tier for 12 months)
- **Neon PostgreSQL**: Free tier available with 512MB storage
- **Total**: $0-25/month depending on usage

## Alternative: Deploy Backend Separately

If you want to deploy the backend independently:

1. **Deploy API to AWS App Runner:**
   - Use `server/Dockerfile`
   - Set environment variables
   - Get API URL

2. **Deploy Frontend to Amplify:**
   - Set `API_ORIGIN` to your App Runner URL
   - Rest follows the same steps

This gives you better scalability and separation of concerns.
