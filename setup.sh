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

# Resolve absolute path to the script's directory to act as project root
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Verify we are in the right place
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    echo "❌ Error: package.json not found in $PROJECT_ROOT"
    echo "Please ensure you run this script from the project root."
    exit 1
fi

# Extract PORT from .env (default to 3000)
PORT=$(grep "^PORT=" "$PROJECT_ROOT/.env" | cut -d '=' -f2 | tr -d '[:space:]')
if [ -z "$PORT" ]; then
    PORT="3000"
fi
echo "   - API Port: $PORT"

echo ""
echo "🧹 Cleaning up existing processes..."

# Kill existing PM2 processes
pm2 delete all 2>/dev/null || true

# Kill any existing processes on required ports
fuser -k 5173/tcp 2>/dev/null || true
fuser -k $PORT/tcp 2>/dev/null || true

echo ""
echo "📝 Generating ecosystem.config.cjs..."

# Determine WebApp script
WEBAPP_SCRIPT=""
if [ -d "$PROJECT_ROOT/src/webapp" ]; then
    WEBAPP_SCRIPT="
    {
      name: \"agentifi-webapp\",
      script: \"python3\",
      args: \"-m http.server 5173\",
      cwd: \"$PROJECT_ROOT/src/webapp\",
      autorestart: true
    },"
fi

cat > "$PROJECT_ROOT/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: "agentifi-bot",
      script: "npm",
      args: "run start",
      cwd: "$PROJECT_ROOT",
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "agentifi-ngrok",
      script: "ngrok",
      args: "http $PORT",
      cwd: "$PROJECT_ROOT",
      autorestart: true
    },$WEBAPP_SCRIPT
  ]
};
EOF

echo "✅ Generated PM2 config."
echo ""
echo "🚀 Starting services via PM2..."
echo ""

# Check for PM2
if ! command -v pm2 &> /dev/null; then
    if command -v npm &> /dev/null; then
        npm install -g pm2
    else
        bun add -g pm2
    fi
fi

# Start from ecosystem file
pm2 start "$PROJECT_ROOT/ecosystem.config.cjs"

# Wait for ngrok to start and get the URL
echo ""
echo "⏳ Waiting for ngrok tunnel..."
sleep 5

NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok-free\.app' | head -1)

if [ -n "$NGROK_URL" ]; then
    echo "✅ Ngrok URL: $NGROK_URL"
    
    # Update WEBHOOK_URL in .env (base URL without /webhook - code adds it)
    if grep -q "^WEBHOOK_URL=" "$PROJECT_ROOT/.env"; then
        sed -i.bak "s|^WEBHOOK_URL=.*|WEBHOOK_URL=$NGROK_URL|" "$PROJECT_ROOT/.env"
    else
        echo "WEBHOOK_URL=$NGROK_URL" >> "$PROJECT_ROOT/.env"
    fi
    
    echo "✅ Updated WEBHOOK_URL in .env"
    
    # Restart bot to pick up new webhook URL
    echo "🔄 Restarting bot with new webhook..."
    pm2 restart agentifi-bot
else
    echo "⚠️  Could not get ngrok URL - webhook may not work"
    echo "   Check: curl http://localhost:4040/api/tunnels"
fi

pm2 save --force
pm2 startup | grep "sudo" | bash 2>/dev/null || true

echo ""
echo "✅ Deployment Successful!"
echo "   - Bot: Online"
echo "   - Ngrok: Online"
if [ -n "$WEBAPP_SCRIPT" ]; then
    echo "   - WebApp: http://localhost:5173"
fi
if [ -n "$NGROK_URL" ]; then
    echo "   - Webhook: $NGROK_URL/webhook"
fi
echo ""
echo "📊 Monitoring commands:"
echo "   pm2 logs      # View logs"
echo "   pm2 monit     # Monitor processes"
echo "   pm2 status    # Check status"
