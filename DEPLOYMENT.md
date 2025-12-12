# 🚀 Deployment Guide

Complete guide for deploying the Universal Trading API to GitHub and Supabase.

---

## 📦 Part 1: GitHub Deployment

### Step 1: Initialize Git Repository

```bash
cd /Users/nitinbagoriya/Downloads/Archive/AgentiFi-dev

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Universal Trading API with Swagger docs"
```

### Step 2: Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click "New Repository"
3. Name: `universal-trading-api`
4. Description: "Unified API for trading across multiple exchanges"
5. **Keep it Private** (contains sensitive code)
6. Don't initialize with README (we have one)
7. Click "Create repository"

### Step 3: Push to GitHub

```bash
# Add remote
git remote add origin https://github.com/YOUR_USERNAME/universal-trading-api.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 4: Verify Deployment

Visit: `https://github.com/YOUR_USERNAME/universal-trading-api`

You should see:

- ✅ README.md with project overview
- ✅ All source code
- ✅ Documentation files
- ✅ .gitignore (no .env file)

---

## ☁️ Part 2: Supabase Deployment

### Step 1: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Or using npm
npm install -g supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser for authentication.

### Step 3: Link to Supabase Project

```bash
# Create new project or link existing
supabase link --project-ref your-project-ref

# Or create new project
supabase projects create universal-trading-api
```

### Step 4: Deploy Edge Function

```bash
# Deploy the universal-api function
supabase functions deploy universal-api

# Set environment variables
supabase secrets set ASTER_API_KEY=your_key
supabase secrets set ASTER_API_SECRET=your_secret
supabase secrets set HYPERLIQUID_PRIVATE_KEY=your_key
supabase secrets set HYPERLIQUID_ADDRESS=your_address
```

### Step 5: Test Deployment

```bash
# Get your function URL
supabase functions list

# Test the endpoint
curl https://your-project.supabase.co/functions/v1/universal-api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": 1765543493819,
  "message": "Universal Trading API on Supabase"
}
```

---

## 🐳 Part 3: Docker Deployment (Alternative)

### Step 1: Build Docker Image

```bash
# Build the image
docker build -t universal-trading-api .

# Test locally
docker run -p 3000:3000 --env-file .env universal-trading-api
```

### Step 2: Push to Docker Hub

```bash
# Tag the image
docker tag universal-trading-api YOUR_USERNAME/universal-trading-api:latest

# Push to Docker Hub
docker push YOUR_USERNAME/universal-trading-api:latest
```

### Step 3: Deploy to Cloud

**AWS ECS / Google Cloud Run / Azure Container Instances**

```bash
# Example for Google Cloud Run
gcloud run deploy universal-trading-api \
  --image YOUR_USERNAME/universal-trading-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🔧 Environment Variables Setup

### For Supabase

```bash
# Set all required secrets
supabase secrets set ASTER_API_KEY=your_aster_api_key
supabase secrets set ASTER_API_SECRET=your_aster_api_secret
supabase secrets set HYPERLIQUID_PRIVATE_KEY=0xyour_private_key
supabase secrets set HYPERLIQUID_ADDRESS=0xyour_address
supabase secrets set PORT=3000
supabase secrets set NODE_ENV=production
```

### For Docker/Cloud

Create `.env` file (don't commit!):

```env
ASTER_API_KEY=your_aster_api_key
ASTER_API_SECRET=your_aster_api_secret
HYPERLIQUID_PRIVATE_KEY=0xyour_private_key
HYPERLIQUID_ADDRESS=0xyour_address
PORT=3000
NODE_ENV=production
```

---

## 📊 Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (17/17)
- [ ] Environment variables configured
- [ ] .env file in .gitignore
- [ ] README.md updated
- [ ] API documentation complete

### GitHub

- [ ] Repository created
- [ ] Code pushed to main branch
- [ ] .gitignore working (no .env)
- [ ] README visible
- [ ] Repository set to private

### Supabase

- [ ] Supabase CLI installed
- [ ] Logged in to Supabase
- [ ] Project created/linked
- [ ] Edge function deployed
- [ ] Environment secrets set
- [ ] Function tested and working

### Post-Deployment

- [ ] API accessible via URL
- [ ] Health check working
- [ ] Documentation accessible
- [ ] All endpoints responding
- [ ] CORS configured correctly

---

## 🌐 Access Your Deployed API

### Supabase URL Format

```
https://your-project.supabase.co/functions/v1/universal-api/
```

### Endpoints

- Health: `/health`
- Docs: `/docs`
- Assets: `/assets?exchange=aster`
- Ticker: `/ticker/ETHUSDT?exchange=aster`
- Orderbook: `/orderbook/ETH?exchange=hyperliquid`

---

## 🔒 Security Best Practices

### 1. Never Commit Secrets

```bash
# Always check before committing
git status

# Ensure .env is ignored
cat .gitignore | grep .env
```

### 2. Use Environment Variables

- Store all secrets in Supabase Secrets
- Never hardcode API keys
- Rotate keys regularly

### 3. Enable CORS Properly

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specific domain
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

### 4. Rate Limiting

Consider adding rate limiting:

```typescript
// Example with Supabase Edge Functions
const rateLimit = new Map();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimit.get(ip) || [];
  const recentRequests = requests.filter(t => now - t < 60000);

  if (recentRequests.length >= 60) {
    return false; // Rate limit exceeded
  }

  recentRequests.push(now);
  rateLimit.set(ip, recentRequests);
  return true;
}
```

---

## 🐛 Troubleshooting

### Issue: Function not deploying

```bash
# Check Supabase CLI version
supabase --version

# Update if needed
brew upgrade supabase

# Re-deploy
supabase functions deploy universal-api --no-verify-jwt
```

### Issue: Environment variables not working

```bash
# List all secrets
supabase secrets list

# Unset and reset
supabase secrets unset ASTER_API_KEY
supabase secrets set ASTER_API_KEY=new_value
```

### Issue: CORS errors

```typescript
// Ensure CORS headers in all responses
return new Response(data, {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  },
});
```

---

## 📞 Support

### GitHub Issues

Create issues at: `https://github.com/YOUR_USERNAME/universal-trading-api/issues`

### Supabase Support

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)

---

## 🎉 Success!

Once deployed, your API will be:

- ✅ Publicly accessible via Supabase URL
- ✅ Version controlled on GitHub
- ✅ Scalable and reliable
- ✅ Documented with Swagger
- ✅ Ready for production use

**Congratulations on deploying your Universal Trading API! 🚀**
