# 🚀 Complete Local Development Guide

## One-Command Startup

```bash
./auto-start.sh
```

That's it! This automatically:

- ✅ Checks all dependencies (Bun, ngrok, Redis, PostgreSQL)
- ✅ Starts ngrok tunnel
- ✅ Configures webhook URL
- ✅ Starts bot + API server
- ✅ Everything ready to test!

---

## What You'll See

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 AgentiFi Auto-Start
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[→] Detecting environment...
[✓] Running on local machine

[→] Checking dependencies...
[✓] Bun 1.2.12 installed
[✓] ngrok available

[→] Loading environment configuration...
[✓] Environment variables loaded

[→] Checking database connection...
[✓] PostgreSQL connection successful

[→] Checking Redis connection...
[✓] Redis connection successful

[→] Configuring webhook...
[✓] Starting ngrok tunnel...
[✓] ngrok tunnel active: https://abc123.ngrok-free.app

[→] Starting AgentiFi Bot + API Server...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 Configuration Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment: Local
  Port: 3742
  Webhook: https://abc123.ngrok-free.app
  Database: db.supabase.com
  Redis: localhost:6379
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Starting AgentiFi Trading Bot...

[DB] ✅ PostgreSQL ready
[DB] ✅ Redis ready
[Bot] ✅ Bot created
[Bot] ✅ Authenticated: @My_Test_Tradeee1_bot
🔗 Webhook set: https://abc123.ngrok-free.app/webhook
✅ AgentiFi Bot + API Server running
```

---

## Complete Architecture

```
┌─────────────────────────────────────────────────┐
│                  YOUR MACHINE                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐      ┌──────────────┐        │
│  │   Telegram   │◄────►│     Bot      │        │
│  │     Bot      │      │  (Port 3742) │        │
│  └──────────────┘      └──────┬───────┘        │
│         ▲                     │                 │
│         │                     │                 │
│         │                     ▼                 │
│  ┌──────┴──────┐      ┌──────────────┐        │
│  │    ngrok    │      │  API Server  │        │
│  │   Tunnel    │      │  (Port 3742) │        │
│  └─────────────┘      └──────┬───────┘        │
│                               │                 │
│                               ▼                 │
│                       ┌──────────────┐         │
│                       │    Redis     │         │
│                       │ (localhost)  │         │
│                       └──────────────┘         │
│                                                  │
└─────────────────────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │   Supabase DB    │
              │   (Cloud)        │
              └──────────────────┘
```

---

## Prerequisites

### 1. Install Dependencies

**Bun (JavaScript runtime):**

```bash
curl -fsSL https://bun.sh/install | bash
```

**ngrok (for webhook):**

```bash
# macOS
brew install ngrok

# Get auth token from https://ngrok.com
ngrok config add-authtoken YOUR_TOKEN
```

**Redis (local cache):**

```bash
# macOS
brew install redis
brew services start redis

# Verify
redis-cli ping
# Should return: PONG
```

**PostgreSQL client (optional, for testing):**

```bash
brew install postgresql
```

### 2. Setup .env File

Create `.env` in project root:

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# Database (Supabase)
DATABASE_URL=postgresql://postgres:password@host:5432/postgres

# Redis (local)
REDIS_URL=redis://localhost:6379

# Server
PORT=3742
NODE_ENV=development

# Encryption
ENCRYPTION_KEY=your_32_char_hex_key

# Webhook (auto-configured by auto-start.sh)
WEBHOOK_URL=
WEBHOOK_SECRET=your_secret
```

---

## Step-by-Step First Run

### 1. Clone & Setup

```bash
# Clone repo
git clone https://github.com/NitinBag0riya/agentiicc-term.git
cd agentiicc-term

# Install dependencies
bun install

# Create .env (copy from above)
nano .env
```

### 2. Start Everything

```bash
./auto-start.sh
```

### 3. Test the Bot

Open Telegram and message your bot:

```
/start
```

You should see the welcome screen with buttons!

### 4. Test the API

```bash
# Health check
curl http://localhost:3742/health

# Should return: {"status":"ok"}
```

---

## What's Running

When `auto-start.sh` is running:

| Component    | Status        | Port | URL                                |
| ------------ | ------------- | ---- | ---------------------------------- |
| Bot          | ✅ Running    | -    | Telegram                           |
| API Server   | ✅ Running    | 3742 | http://localhost:3742              |
| ngrok Tunnel | ✅ Running    | -    | https://xxx.ngrok-free.app         |
| Webhook      | ✅ Configured | -    | https://xxx.ngrok-free.app/webhook |
| Redis        | ✅ Running    | 6379 | localhost:6379                     |
| PostgreSQL   | ✅ Cloud      | 5432 | Supabase                           |

---

## Testing Everything

### Test Bot Commands

In Telegram:

```
/start          - Welcome screen
/menu           - Main menu
/help           - Help screen
```

### Test API Endpoints

```bash
# Health check
curl http://localhost:3742/health

# Get assets (requires auth)
curl http://localhost:3742/assets

# Check webhook
curl https://YOUR_NGROK_URL.ngrok-free.app/webhook
# Should return 404 (expected, means it's working)
```

### Test Database

```bash
# Check connection
psql "$DATABASE_URL" -c "SELECT 1"

# Or use the bot - link an exchange and check if data persists
```

### Test Redis

```bash
# Check if running
redis-cli ping

# Check keys
redis-cli keys "*"
```

---

## Development Workflow

### Making Changes

```bash
# 1. Make code changes
nano src/bot/scenes/welcome.scene.ts

# 2. Restart (auto-start.sh has hot reload)
# Just save the file, it will auto-reload!

# 3. Test in Telegram
# Send /start to see changes
```

### Viewing Logs

The console shows everything:

```
[Webhook] 📩 Received update: 123456
[Bot] Global command detected: /start
[Debug] welcomeScene.enter triggered
[Webhook] ✅ Update processed
```

### Stopping

Press `Ctrl+C` to stop everything cleanly.

---

## Common Issues & Fixes

### ngrok Not Working

```bash
# Check if ngrok is installed
which ngrok

# If not found, install
brew install ngrok

# Add auth token
ngrok config add-authtoken YOUR_TOKEN
```

### Redis Not Running

```bash
# Start Redis
brew services start redis

# Or manually
redis-server --daemonize yes

# Verify
redis-cli ping
```

### Database Connection Failed

```bash
# Check DATABASE_URL in .env
echo $DATABASE_URL

# Test connection
psql "$DATABASE_URL" -c "SELECT 1"

# If fails, check Supabase dashboard
```

### Bot Not Responding

```bash
# Check webhook
curl https://YOUR_NGROK_URL/webhook

# Check bot token
echo $TELEGRAM_BOT_TOKEN

# Restart
./auto-start.sh
```

### Port Already in Use

```bash
# Kill existing process
pkill -f "bun.*index.ts"

# Or change port in .env
PORT=3743

# Restart
./auto-start.sh
```

---

## Alternative: Manual Start (Without auto-start.sh)

If you want to start components individually:

### 1. Start ngrok

```bash
ngrok http 3742 &
sleep 3
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*ngrok-free.app' | head -n 1)
echo "Ngrok URL: $NGROK_URL"
```

### 2. Update .env

```bash
echo "WEBHOOK_URL=$NGROK_URL" >> .env
```

### 3. Start bot

```bash
bun run dev
```

---

## File Structure

```
AgentiFi-dev/
├── auto-start.sh           ← Run this!
├── .env                    ← Your config
├── src/
│   ├── index.ts           ← Main entry
│   ├── bot/
│   │   ├── bot.ts         ← Bot setup
│   │   ├── scenes/        ← All 43 scenes
│   │   │   ├── welcome.scene.ts
│   │   │   ├── citadel-aster.scene.ts
│   │   │   └── ...
│   │   └── services/
│   │       └── universal-api.service.ts
│   └── api/
│       └── server.ts      ← API server
├── scripts/
│   ├── start-live.sh      ← Alternative start
│   └── ...
└── package.json
```

---

## Quick Reference

| Task                 | Command                              |
| -------------------- | ------------------------------------ |
| **Start everything** | `./auto-start.sh`                    |
| **Stop**             | `Ctrl+C`                             |
| **View logs**        | (in console)                         |
| **Test bot**         | Message @My_Test_Tradeee1_bot        |
| **Test API**         | `curl http://localhost:3742/health`  |
| **Check Redis**      | `redis-cli ping`                     |
| **Check DB**         | `psql "$DATABASE_URL" -c "SELECT 1"` |
| **Restart**          | `Ctrl+C` then `./auto-start.sh`      |

---

## Next Steps

1. ✅ Run `./auto-start.sh`
2. ✅ Test bot in Telegram
3. ✅ Link an exchange (Aster or Hyperliquid)
4. ✅ Try trading commands
5. ✅ Check API endpoints
6. ✅ Make code changes and test

**That's it! You're ready to develop! 🚀**
