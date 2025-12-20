# AgentiFi Trading Bot - Quick Start

## 🚀 Get Started in 3 Steps

### Step 1: Run Setup Script

```bash
./setup.sh
```

This will:

- ✅ Check/install Bun
- ✅ Install dependencies
- ✅ Validate environment variables
- ✅ Optionally setup ngrok

### Step 2: Configure Environment

Edit `.env` with your credentials:

```bash
TELEGRAM_BOT_TOKEN=your_token_here
DATABASE_URL=your_supabase_url
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 32)
```

### Step 3: Start the Bot

```bash
bun start
```

## ✅ Verify It Works

**Test API:**

```bash
curl http://localhost:3000/health
```

**Test Bot:**

1. Open Telegram
2. Search for your bot
3. Send `/start`

## 📚 Documentation

- **Full Deployment Guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Module 1 Walkthrough**: See artifacts folder
- **DFD Documentation**: See [documentation.json](./documentation.json)

## 🆘 Need Help?

**Common Issues:**

- Bot not responding? Check webhook: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
- Database error? Verify DATABASE_URL includes `?sslmode=require`
- Redis error? Check Redis is running: `redis-cli ping`

**Get Support:**

- Check [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting section
- Review Module 1 walkthrough in artifacts
- Check application logs

## 🎯 What's Implemented (Module 1)

✅ Authentication flow with referral validation
✅ Bot core with command handlers
✅ Redis session management  
✅ Webhook integration
✅ API endpoints for user/credentials
✅ Data transformation utilities

## 🔜 Coming Next (Module 2)

- Citadel overview with real account data
- Trading interface (buy/sell)
- Position management
- Order execution

---

**Ready to test?** Run `./setup.sh` and follow the prompts!
