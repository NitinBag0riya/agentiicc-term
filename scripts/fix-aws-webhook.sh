#!/bin/bash

# fix-aws-webhook.sh
# Updates .env with AWS public IP and restarts the bot

set -e

echo "🔧 Fixing AWS Webhook Configuration..."

# Detect AWS Public IP
AWS_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")

if [ -z "$AWS_IP" ]; then
    echo "❌ Could not detect AWS public IP!"
    echo "Are you running this on an AWS EC2 instance?"
    read -p "Enter your public IP or domain manually: " AWS_IP
    
    if [ -z "$AWS_IP" ]; then
        echo "❌ No IP provided. Exiting."
        exit 1
    fi
fi

echo "✅ Detected/Using IP: $AWS_IP"

# Determine protocol and port
read -p "Use HTTPS? (y/n, default: y): " USE_HTTPS
USE_HTTPS=${USE_HTTPS:-y}

if [[ "$USE_HTTPS" =~ ^[Yy]$ ]]; then
    PROTOCOL="https"
else
    PROTOCOL="http"
fi

read -p "Enter port (default: 3742): " PORT
PORT=${PORT:-3742}

# Construct webhook URL
WEBHOOK_URL="${PROTOCOL}://${AWS_IP}:${PORT}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 New Configuration:"
echo "   WEBHOOK_URL=$WEBHOOK_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Backup .env
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up .env"
fi

# Update or add WEBHOOK_URL in .env
if grep -q "^WEBHOOK_URL=" .env 2>/dev/null; then
    # Update existing
    sed -i.bak "s|^WEBHOOK_URL=.*|WEBHOOK_URL=$WEBHOOK_URL|" .env
    echo "✅ Updated WEBHOOK_URL in .env"
else
    # Add new
    echo "WEBHOOK_URL=$WEBHOOK_URL" >> .env
    echo "✅ Added WEBHOOK_URL to .env"
fi

# Also update WEBAPP_URL if it exists
if grep -q "^WEBAPP_URL=" .env 2>/dev/null; then
    sed -i.bak "s|^WEBAPP_URL=.*|WEBAPP_URL=$WEBHOOK_URL|" .env
    echo "✅ Updated WEBAPP_URL in .env"
fi

# Clean up backup files
rm -f .env.bak

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Configuration Updated!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "If using systemd:"
echo "  sudo systemctl restart agentifi"
echo "  sudo journalctl -u agentifi -f"
echo ""
echo "If running manually:"
echo "  pkill -f 'bun.*index.ts'"
echo "  ./scripts/start-production.sh"
echo ""
