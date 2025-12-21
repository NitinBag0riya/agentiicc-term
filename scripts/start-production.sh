#!/bin/bash

# start-production.sh
# Production startup script for AWS/Cloud environments (NO ngrok)

set -e

# Ensure Bun is in PATH
export PATH="$HOME/.bun/bin:/usr/local/bin:$PATH"

echo "🚀 Starting AgentiFi in Production Mode..."

# 1. Check Dependencies
if ! command -v bun &> /dev/null; then
    echo "❌ 'bun' is not installed."
    exit 1
fi

# 2. Load environment variables
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Please create .env with required variables:"
    echo "   - TELEGRAM_BOT_TOKEN"
    echo "   - DATABASE_URL"
    echo "   - WEBHOOK_URL (your public domain/IP)"
    exit 1
fi

# Source .env
export $(grep -v '^#' .env | xargs)

# 3. Validate required environment variables
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN not set in .env"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env"
    exit 1
fi

if [ -z "$WEBHOOK_URL" ]; then
    echo "⚠️  WARNING: WEBHOOK_URL not set - bot will not receive updates!"
    echo "   Set WEBHOOK_URL in .env to your public domain/IP"
    echo "   Example: WEBHOOK_URL=https://yourdomain.com"
fi

# 4. Start the Bot + API Server
echo "📦 Starting Bot + API Server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Mode: Production (No ngrok)"
echo "📡 Port: ${PORT:-3742}"
echo "🔗 Webhook: ${WEBHOOK_URL:-'Not configured'}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run with bun
exec bun src/index.ts
