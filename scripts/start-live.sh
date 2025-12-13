#!/bin/bash

# start-live.sh
# Orchestrates API Server + Ngrok for immediate live environment

set -e

cleanup() {
    echo -e "\n🛑 Shutting down..."
    kill $(jobs -p) 2>/dev/null || true
    rm -f server.log ngrok.log
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "🚀 Starting Live Server Environment..."

# 1. Check Dependencies
if ! command -v bun &> /dev/null; then
    echo "❌ 'bun' is not installed."
    exit 1
fi

if ! command -v ngrok &> /dev/null; then
    echo "❌ 'ngrok' is not installed."
    echo "   Install it via: brew install ngrok/ngrok/ngrok"
    exit 1
fi

# 2. Start API Server (Background)
echo "📦 Starting API Server (Port 3000)..."
bun src/run-api-only.ts > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
echo "   Waiting for server readiness..."
while ! grep -q "Available endpoints" server.log; do
    if ! ps -p $SERVER_PID > /dev/null; then
        echo "❌ Server failed to start. Check server.log:"
        cat server.log
        exit 1
    fi
    sleep 1
done
echo "✅ API Server is UP"

# 3. Start Ngrok (Background)
echo "🌍 Establishing Ngrok Tunnel..."
ngrok http 3000 > /dev/null 2>&1 &
NGROK_PID=$!

sleep 3 # Give ngrok valid time to connect

# 4. Extract URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*ngrok-free.app')

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get Ngrok URL. Is Ngrok authenticated?"
    echo "   Run: ngrok config add-authtoken <TOKEN>"
    kill $SERVER_PID $NGROK_PID
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "🎉 LIVE ENDPOINT ACTIVE"
echo "👉 URL: $NGROK_URL"
echo "════════════════════════════════════════════════════"
echo ""
echo "📝 To Verify:"
echo "   bun src/verify-live.ts $NGROK_URL"
echo ""
echo "📝 For Postman:"
echo "   Set 'baseUrl_Live' to: $NGROK_URL"
echo ""
echo "Press [CTRL+C] to stop everything."

# Keep script running to maintain processes
wait
