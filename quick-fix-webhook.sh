#!/bin/bash

# quick-fix-webhook.sh
# Quick fix for corrupted WEBHOOK_URL on AWS

echo "🔧 Quick Fix for Webhook URL"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Backup
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backed up .env"

# Remove corrupted WEBHOOK_URL
sed -i '/^WEBHOOK_URL=/d' .env
echo "✅ Removed corrupted WEBHOOK_URL"

# For AWS - just leave it empty (bot will work without webhook for testing)
echo "WEBHOOK_URL=" >> .env
echo "✅ Set WEBHOOK_URL to empty (bot will work without Telegram updates)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Fixed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The bot will now start without webhook errors."
echo "API will work at http://localhost:3742"
echo ""
echo "To enable Telegram bot (later):"
echo "1. Get a domain with SSL"
echo "2. Set WEBHOOK_URL=https://yourdomain.com in .env"
echo "3. Restart bot"
echo ""
echo "Now run: bun src/index.ts"
