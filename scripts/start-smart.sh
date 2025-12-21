#!/bin/bash

# Smart Startup Script for AgentiFi
# Automatically detects ngrok tunnels or uses static config.

echo "🚀 Starting AgentiFi (Smart Mode)..."

# 1. Try to detect Ngrok (Local Dev)
# We use a short timeout so it doesn't hang if ngrok isn't there
NGROK_API="http://127.0.0.1:4040/api/tunnels"

if command -v curl &> /dev/null; then
    NGROK_RESPONSE=$(curl --max-time 0.5 -s "$NGROK_API")
    
    if [ ! -z "$NGROK_RESPONSE" ]; then
        # Parse public_url using grep/sed (avoiding jq dependency if possible, though bun might have it)
        # Looking for "public_url":"https://..."
        NGROK_URL=$(echo "$NGROK_RESPONSE" | grep -o '"public_url":"[^"]*' | head -n 1 | cut -d'"' -f4)
        
        if [ ! -z "$NGROK_URL" ] && [[ "$NGROK_URL" == https* ]]; then
            echo "🌍 Detected Ngrok Tunnel: $NGROK_URL"
            export WEBAPP_URL="$NGROK_URL"
            export WEBHOOK_URL="$NGROK_URL/webhook"
            
            # Update/Append to .env purely for reference (optional, but helpful)
            # We explicitly DO NOT overwrite strictly static configs if the user wants them, 
            # but for 'auto' mode, dynamic wins.
        fi
    fi
fi

# 2. Check variables
if [ -z "$WEBAPP_URL" ]; then
    # Load from .env if not already set by Step 1
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs)
    fi
    
    if [ -z "$WEBAPP_URL" ]; then
        echo "⚠️  No WEBAPP_URL found in Ngrok or .env. Defaulting to localhost."
        export WEBAPP_URL="http://localhost:3000"
    else
        echo "✅ Using Configured URL: $WEBAPP_URL"
    fi
fi

echo "🎯 WebApp URL set to: $WEBAPP_URL"

# 3. Start the Bot
# Pass the environment variables explicitly
exec bun src/index.ts
