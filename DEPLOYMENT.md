# AgentiFi Trading Bot - Deployment Guide

## Quick Start (Local Development)

### 1. Prerequisites

- **Bun** (recommended) or **Node.js 18+**
- **PostgreSQL** (Supabase recommended)
- **Redis** (local or cloud)
- **Telegram Bot Token** (from @BotFather)
- **ngrok** (for local webhook testing)

### 2. Installation

**Option A: Automated Setup (Recommended)**

```bash
./setup.sh
```

**Option B: Manual Setup**

```bash
# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 3. Environment Configuration

Edit `.env` with your credentials:

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app
WEBHOOK_SECRET=random_secret_string_here
PORT=3000

# Database (Supabase)
DATABASE_URL=postgresql://user:pass@host:5432/database?sslmode=require

# Redis
REDIS_URL=redis://localhost:6379
# Or for cloud Redis:
# REDIS_URL=redis://user:pass@host:port

# Security
ENCRYPTION_KEY=random_32_character_encryption_key
```

### 4. Start the Bot

```bash
# Development mode (with auto-reload)
bun run dev

# Production mode
bun start

# Or directly
bun run src/index.ts
```

### 5. Verify Installation

**Test API:**

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":...}
```

**Test Bot:**

1. Open Telegram
2. Search for your bot (@YourBotUsername)
3. Send `/start`
4. You should see the welcome message

---

## Production Deployment

### Option 1: Railway

1. **Create Railway Project**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set TELEGRAM_BOT_TOKEN=your_token
railway variables set DATABASE_URL=your_supabase_url
railway variables set REDIS_URL=your_redis_url
railway variables set ENCRYPTION_KEY=your_key
railway variables set WEBHOOK_SECRET=your_secret

# Deploy
railway up
```

2. **Set Webhook URL**
   After deployment, Railway will give you a URL. Set it as WEBHOOK_URL:

```bash
railway variables set WEBHOOK_URL=https://your-app.railway.app
```

3. **Configure Telegram Webhook**

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.railway.app/webhook",
    "secret_token": "your_webhook_secret"
  }'
```

### Option 2: Render

1. **Create Web Service**

   - Connect your GitHub repo
   - Build Command: `bun install`
   - Start Command: `bun run src/index.ts`

2. **Add Environment Variables** (in Render dashboard)

   - `TELEGRAM_BOT_TOKEN`
   - `DATABASE_URL`
   - `REDIS_URL`
   - `ENCRYPTION_KEY`
   - `WEBHOOK_SECRET`
   - `WEBHOOK_URL` (your Render URL)
   - `PORT` (leave empty, Render sets this)

3. **Deploy** and set webhook (same as Railway step 3)

### Option 3: Heroku

1. **Create Heroku App**

```bash
heroku create your-app-name

# Add Postgres
heroku addons:create heroku-postgresql:mini

# Add Redis
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set ENCRYPTION_KEY=your_key
heroku config:set WEBHOOK_SECRET=your_secret
heroku config:set WEBHOOK_URL=https://your-app.herokuapp.com

# Deploy
git push heroku ui-master:main
```

2. **Set webhook** (same as Railway step 3)

### Option 4: VPS (Ubuntu/Debian)

1. **Install Dependencies**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Redis
sudo apt install redis-server -y

# Install nginx (for reverse proxy)
sudo apt install nginx -y
```

2. **Setup Application**

```bash
# Clone repository
git clone https://github.com/your-repo/agentifi-dev.git
cd agentifi-dev

# Install dependencies
bun install

# Create .env
cp .env.example .env
nano .env  # Edit with your credentials
```

3. **Setup PM2 (Process Manager)**

```bash
# Install PM2
bun add -g pm2

# Start bot
pm2 start src/index.ts --name agentifi-bot --interpreter bun

# Save PM2 config
pm2 save

# Setup auto-start
pm2 startup
```

4. **Configure Nginx**

```nginx
# /etc/nginx/sites-available/agentifi
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/agentifi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

5. **Set webhook** (use your domain)

---

## Database Setup

### Supabase (Recommended)

1. **Create Project** at https://supabase.com
2. **Get Connection String** from Settings → Database
3. **Tables are auto-created** on first run via `initSchema()`

### Manual PostgreSQL Setup

```sql
-- Create database
CREATE DATABASE agentifi;

-- Connect to database
\c agentifi

-- Tables will be created automatically by the app
-- Or run manually:

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  referral_code TEXT UNIQUE,
  referred_by INTEGER REFERENCES users(id),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE api_credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  exchange_id TEXT NOT NULL DEFAULT 'aster',
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  additional_data_encrypted TEXT,
  testnet BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, exchange_id)
);
```

---

## Redis Setup

### Local Redis

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
```

### Cloud Redis Options

- **Upstash** (free tier): https://upstash.com
- **Redis Cloud** (free tier): https://redis.com/try-free
- **Railway** (paid): Built-in Redis addon

---

## Troubleshooting

### Bot Not Responding

**Check webhook status:**

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

**Delete and reset webhook:**

```bash
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-url.com/webhook" \
  -d "secret_token=your_secret"
```

### Database Connection Issues

**Test connection:**

```bash
psql $DATABASE_URL
```

**Check SSL requirement:**

- Supabase requires `?sslmode=require` in connection string

### Redis Connection Issues

**Test connection:**

```bash
redis-cli -u $REDIS_URL ping
# Expected: PONG
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)
```

---

## Monitoring & Logs

### PM2 Logs

```bash
pm2 logs agentifi-bot
pm2 monit
```

### Railway Logs

```bash
railway logs
```

### Heroku Logs

```bash
heroku logs --tail
```

---

## Security Best Practices

1. **Never commit `.env` file**

   - Already in `.gitignore`
   - Use environment variables in production

2. **Rotate secrets regularly**

   - `ENCRYPTION_KEY`
   - `WEBHOOK_SECRET`
   - API credentials

3. **Use strong encryption key**

```bash
# Generate secure key
openssl rand -hex 32
```

4. **Enable SSL/TLS**

   - Required for Telegram webhooks
   - Use Let's Encrypt for free SSL

5. **Restrict database access**
   - Use connection pooling
   - Set up read replicas for scaling

---

## Scaling Considerations

### Horizontal Scaling

- Use Redis for session storage (already implemented)
- Deploy multiple instances behind load balancer
- Use webhook mode (not polling)

### Database Optimization

- Add indexes on frequently queried columns
- Use connection pooling
- Consider read replicas

### Caching

- Redis caching for market data
- Session caching (already implemented)

---

## Support

**Issues:** https://github.com/your-repo/issues
**Documentation:** See `/docs` folder
**Module 1 Walkthrough:** See artifacts folder

---

## Next Steps

After successful deployment:

1. Test all Module 1 features
2. Monitor logs for errors
3. Set up monitoring (optional)
4. Proceed with Module 2 implementation
