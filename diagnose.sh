#!/bin/bash

# Diagnostic script to test bot startup
# Run this to see detailed error messages

echo "🔍 AgentiFi Bot Diagnostic"
echo "=========================="
echo ""

echo "1️⃣ Checking Bun installation..."
if command -v bun &> /dev/null; then
    echo "✅ Bun found: $(bun --version)"
else
    echo "❌ Bun not found"
    exit 1
fi

echo ""
echo "2️⃣ Checking environment variables..."
required_vars=("TELEGRAM_BOT_TOKEN" "DATABASE_URL" "REDIS_URL" "ENCRYPTION_KEY")
missing=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing+=("$var")
    fi
done

if [ ${#missing[@]} -ne 0 ]; then
    echo "❌ Missing environment variables:"
    printf '   - %s\n' "${missing[@]}"
    exit 1
else
    echo "✅ All required environment variables set"
fi

echo ""
echo "3️⃣ Testing database connection..."
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
        echo "✅ PostgreSQL connection successful"
    else
        echo "⚠️  PostgreSQL connection failed (but will continue)"
    fi
else
    echo "⚠️  psql not installed, skipping DB test"
fi

echo ""
echo "4️⃣ Testing Redis connection..."
if command -v redis-cli &> /dev/null; then
    if redis-cli -u "$REDIS_URL" ping &> /dev/null; then
        echo "✅ Redis connection successful"
    else
        echo "⚠️  Redis connection failed (but will continue)"
    fi
else
    echo "⚠️  redis-cli not installed, skipping Redis test"
fi

echo ""
echo "5️⃣ Installing dependencies..."
bun install

echo ""
echo "6️⃣ Starting bot with detailed logging..."
echo "=========================="
echo ""

# Run with full error output
bun run src/index.ts
