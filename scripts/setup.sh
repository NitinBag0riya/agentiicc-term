#!/bin/bash

# Cloud-Only Setup Script

echo "🚀 Starting AgentFi Cloud-Only Setup..."

# 1. Environment Configuration
if [ -f .env ]; then
    echo "✅ .env file already exists."
else
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Please open .env and fill in your DATABASE_URL and API keys!"
fi

# 2. Install Dependencies
echo "📦 Installing dependencies..."
if command -v bun &> /dev/null; then
    bun install
else
    echo "⚠️  'bun' is not installed. Falling back to npm..."
    npm install
fi

# 3. Final Instructions
echo "
🎉 Setup Complete!

To start the server:
  bun start

To run API tests:
  bun run test:api

To verify robust functionality:
  bun run test:api:robust

Note: Ensure your DATABASE_URL points to your Supabase instance.
"
