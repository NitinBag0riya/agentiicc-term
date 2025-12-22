#!/bin/bash

# AgentiFi Bot - Setup Script
# This script helps you set up and run the bot locally

set -e

echo "🚀 AgentiFi Bot - Setup Script"
echo "================================"
echo ""

# Check for Bun
if ! command -v bun &> /dev/null; then
    echo "⚠️  Bun is not installed."
    echo ""
    read -p "Would you like to install Bun? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Installing Bun..."
        curl -fsSL https://bun.sh/install | bash
        
        # Source the shell config to get bun in PATH
        if [ -f "$HOME/.bashrc" ]; then
            source "$HOME/.bashrc"
        elif [ -f "$HOME/.zshrc" ]; then
            source "$HOME/.zshrc"
        fi
        
        echo "✅ Bun installed successfully!"
    else
        echo "❌ Bun is required to run this bot. Exiting."
        exit 1
    fi
fi

echo ""
echo "📦 Installing dependencies..."
bun install

echo ""
echo "🔧 Checking environment variables..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file. Please edit it with your credentials."
    else
        echo "❌ .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Check required env vars
REQUIRED_VARS=("TELEGRAM_BOT_TOKEN" "DATABASE_URL" "REDIS_URL" "ENCRYPTION_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env || grep -q "^${var}=$" .env || grep -q "^${var}=your_" .env; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo ""
    echo "⚠️  Missing or incomplete environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please edit .env and add these values before running the bot."
    echo ""
    read -p "Open .env in editor now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    fi
    exit 1
fi

echo "✅ All required environment variables are set!"

echo ""
echo "🔄 Checking if ngrok is needed for webhook..."

# Check if WEBHOOK_URL is set
if ! grep -q "^WEBHOOK_URL=http" .env; then
    echo "⚠️  WEBHOOK_URL not set. You'll need ngrok for local development."
    echo ""
    
    if command -v ngrok &> /dev/null; then
        echo "✅ ngrok is installed"
        echo ""
        read -p "Start ngrok tunnel? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            PORT=$(grep "^PORT=" .env | cut -d '=' -f2 || echo "3000")
            echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔑 ngrok Authentication Required"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ngrok requires a free account and auth token."
echo ""
echo "Steps:"
echo "1. Sign up: https://dashboard.ngrok.com/signup"
echo "2. Get token: https://dashboard.ngrok.com/get-started/your-authtoken"
echo ""

# Check if ngrok is already authenticated
if ngrok config check &> /dev/null 2>&1; then
    echo "✅ ngrok already authenticated"
else
    read -p "Enter your ngrok auth token: " NGROK_TOKEN
    
    if [ -z "$NGROK_TOKEN" ]; then
        echo "❌ Auth token required to use ngrok"
        echo ""
        echo "Options:"
        echo "1. Get token from: https://dashboard.ngrok.com/get-started/your-authtoken"
        echo "2. Run manually later: ngrok config add-authtoken YOUR_TOKEN"
        echo "3. Skip ngrok and set WEBHOOK_URL manually in .env"
        exit 1
    fi
    
    # Configure ngrok with token
    if ngrok config add-authtoken "$NGROK_TOKEN" 2>&1; then
        echo "✅ ngrok authenticated successfully"
    else
        echo "❌ Failed to authenticate ngrok"
        echo "Please run manually: ngrok config add-authtoken YOUR_TOKEN"
        exit 1
    fi
fi

echo ""
echo ""
# Resolve absolute path to the script's directory to act as project root
# This ensures it works even if called from another directory
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Verify we are in the right place
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    echo "❌ Error: package.json not found in $PROJECT_ROOT"
    echo "Please ensure you run this script from the project root."
    exit 1
fi

echo ""
# Generate ecosystem.config.js for robust process management
echo "📝 Generating ecosystem.config.js..."
cat > "$PROJECT_ROOT/ecosystem.config.js" <<EOF
module.exports = {
  apps: [
    {
      name: "agentifi-bot",
      script: "npm",
      args: "run start",
      cwd: "$PROJECT_ROOT",
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: "agentifi-ngrok",
      script: "ngrok",
      args: "http $PORT",
      cwd: "$PROJECT_ROOT",
      autorestart: true
    }
  ]
};
EOF

echo "✅ Generated PM2 config."
echo ""
echo "🤖 Starting services via PM2..."
echo ""

# Start/Restart from ecosystem file ensuring fresh config
pm2 start "$PROJECT_ROOT/ecosystem.config.js"
pm2 save --force
pm2 startup | grep "sudo" | bash 2>/dev/null || true

echo ""
echo "✅ Bot & Ngrok started correctly!"
echo "   View logs: pm2 logs"
echo "   Monitor:   pm2 monit"

