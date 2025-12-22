#!/bin/bash

# fix-corrupted-env.sh
# Quick fix for corrupted WEBHOOK_URL in .env

echo "🔧 Fixing corrupted .env file..."

if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Backup
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backed up .env"

# Check for corrupted WEBHOOK_URL
if grep -q "^WEBHOOK_URL=https://3" .env || grep -q "^WEBHOOK_URL=3" .env; then
    echo "⚠️  Found corrupted WEBHOOK_URL"
    
    # Remove corrupted line
    sed -i.bak '/^WEBHOOK_URL=/d' .env
    
    echo ""
    echo "Options:"
    echo "1. Enter your domain (e.g., bot.yourdomain.com)"
    echo "2. Leave empty to skip webhook"
    echo ""
    read -p "Enter domain or press Enter to skip: " DOMAIN
    
    if [ ! -z "$DOMAIN" ]; then
        # Add https:// if not present
        if [[ "$DOMAIN" != https://* ]]; then
            DOMAIN="https://$DOMAIN"
        fi
        echo "WEBHOOK_URL=$DOMAIN" >> .env
        echo "✅ Set WEBHOOK_URL=$DOMAIN"
    else
        echo "WEBHOOK_URL=" >> .env
        echo "✅ Webhook disabled (bot won't receive updates)"
    fi
    
    rm -f .env.bak
    echo ""
    echo "✅ .env fixed!"
    echo ""
    echo "Now run: ./auto-start.sh"
else
    echo "✅ WEBHOOK_URL looks OK"
    grep "^WEBHOOK_URL=" .env || echo "WEBHOOK_URL not set"
fi
