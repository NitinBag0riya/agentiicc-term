# AgentiFi Telegram Bot

Complete Telegram bot UI for the Universal Trading API, supporting multi-exchange perpetual futures trading.

## Features

- 🔗 **Multi-Exchange Support**: Aster DEX & Hyperliquid
- 💰 **Account Management**: View balance and positions
- 📊 **Trading**: Place market and limit orders
- ⚙️ **Position Management**: Adjust leverage and margin
- 🔒 **Secure**: AES-256-GCM encrypted credentials

## Quick Start

### 1. Prerequisites

- Bun runtime installed
- PostgreSQL database (Supabase)
- Universal API server running
- Telegram Bot Token from [@BotFather](https://t.me/botfather)

### 2. Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
# Database (Supabase)
DATABASE_URL=postgresql://user:password@host:port/database

# Universal API
UNIVERSAL_API_URL=http://localhost:3000

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_WEBHOOK_URL=https://your-domain.com  # For production
BOT_PORT=3001

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_64_character_hex_key_here
```

### 3. Start the Bot

**Development (Polling Mode):**

```bash
# Start Universal API first
bun run server:api

# In another terminal, start bot
bun run bot:dev
```

**Production (Webhook Mode):**

```bash
# Set TELEGRAM_WEBHOOK_URL in .env
bun run bot
```

## Bot Commands

- `/start` - Initialize the bot
- `/menu` - Show main menu
- `/link` - Link exchange account
- `/unlink` - Unlink exchange account

## Workflow

### Link Exchange

1. Send `/start` or `/link`
2. Select exchange (Aster DEX or Hyperliquid)
3. Enter credentials:
   - **Aster DEX**: API Key → API Secret
   - **Hyperliquid**: Private Key → Account Address
4. Credentials are encrypted and stored
5. Ready to trade!

### View Balance

1. Send `/menu`
2. Click "💰 Balance"
3. View account details

### View Positions

1. Send `/menu`
2. Click "📊 Positions"
3. View open positions

### Settings

1. Send `/menu`
2. Click "⚙️ Settings"
3. Unlink exchange or view settings

## Architecture

```
src/bot/
├── index.ts                    # Main bot entry
├── config.ts                   # Configuration
├── types/
│   └── context.ts             # Session types
├── utils/
│   ├── encryption.ts          # AES-256-GCM
│   ├── api-client.ts          # Universal API wrapper
│   └── formatters.ts          # Message formatting
├── scenes/
│   ├── link.scene.ts          # Multi-exchange linking
│   └── unlink.scene.ts        # Unlink exchange
└── composers/
    └── main-menu.composer.ts  # Main menu
```

## Security

- All credentials encrypted with AES-256-GCM before storage
- Secure API communication with session tokens
- No credentials stored in plaintext
- Webhook secret validation (production)

## Development

### Run with Auto-Reload

```bash
bun run bot:dev
```

### Testing Locally with ngrok

```bash
# Start ngrok
ngrok http 3001

# Update .env with ngrok URL
TELEGRAM_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app

# Start bot
bun run bot
```

## Deployment

1. Set up production database (Supabase)
2. Deploy Universal API server
3. Set environment variables
4. Set webhook URL
5. Start bot: `bun run bot`

## Troubleshooting

**Bot not responding:**

- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify webhook URL is accessible
- Check Universal API is running

**Credentials not saving:**

- Verify `DATABASE_URL` is correct
- Check `ENCRYPTION_KEY` is set (64 hex chars)
- Ensure database schema is initialized

**API errors:**

- Verify `UNIVERSAL_API_URL` is correct
- Check API server is running
- Verify credentials are valid

## License

MIT
