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
echo "🌐 Starting ngrok on port 3742..."
            ngrok http $PORT &
            NGROK_PID=$!
            
            echo "⏳ Waiting for ngrok to start..."
            sleep 3
            
            # Get ngrok URL
            NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok-free\.app' | head -1)
            
            if [ -n "$NGROK_URL" ]; then
                echo "✅ Ngrok URL: $NGROK_URL"
                echo ""
                echo "📝 Updating .env with WEBHOOK_URL..."
                
                # Update .env
                if grep -q "^WEBHOOK_URL=" .env; then
                    sed -i.bak "s|^WEBHOOK_URL=.*|WEBHOOK_URL=$NGROK_URL|" .env
                else
                    echo "WEBHOOK_URL=$NGROK_URL" >> .env
                fi
                
                # Set webhook secret if not set
                if ! grep -q "^WEBHOOK_SECRET=" .env || grep -q "^WEBHOOK_SECRET=$" .env; then
                    SECRET=$(openssl rand -hex 32)
                    echo "WEBHOOK_SECRET=$SECRET" >> .env
                    echo "✅ Generated WEBHOOK_SECRET"
                fi
                
                echo "✅ .env updated with ngrok URL"
            else
                echo "❌ Could not get ngrok URL. Please check ngrok manually."
            fi
        fi
    else
        echo "⚠️  ngrok is not installed."
        echo ""
        echo "Install ngrok:"
        echo "  brew install ngrok  # macOS"
        echo "  Or download from: https://ngrok.com/download"
        echo ""
        exit 1
    fi
fi

echo ""
echo "================================"
echo "✅ Setup complete!"
echo ""
echo "To start the bot:"
echo "  bun run src/index.ts"
echo ""
echo "Or use the npm script:"
echo "  bun start"
echo ""
echo "To test the API:"
echo "  curl http://localhost:3000/health"
echo ""
echo "To test the bot:"
echo "  Open Telegram and send /start to your bot"
echo ""
