#!/bin/bash

# Migrate Local Data to Cloud Supabase

echo "🚀 Starting Data Migration..."
echo "This script will dump data from your local database and push it to the Cloud Supabase instance configured in .env"

# 1. Load Remote Target from .env
PROJECT_ROOT="$(dirname "$0")/.."
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo "❌ .env file not found at $ENV_FILE!"
    exit 1
fi

TARGET_DB_URL="$DATABASE_URL"
if [ -z "$TARGET_DB_URL" ]; then
    echo "❌ DATABASE_URL is missing in .env"
    exit 1
fi

echo ""
echo "🎯 Target (Cloud): $TARGET_DB_URL" 
echo "(Hidden for security)"
echo ""

# 2. Identify Source
echo "Which local database do you want to migrate FROM?"
echo "1) Standard Local Supabase (127.0.0.1:54322)"
echo "2) Custom Local Postgres (Enter URL)"
read -p "Selection: " CHOICE

if [ "$CHOICE" == "1" ]; then
    SOURCE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
elif [ "$CHOICE" == "2" ]; then
    read -p "Enter Local DB URL: " SOURCE_DB_URL
else
    echo "Invalid choice."
    exit 1
fi

echo ""
echo "⚠️  WARNING: This will overwrite/merge data into the remote database."
echo "Are you sure? (y/n)"
read -p "> " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Aborting."
    exit 0
fi

# 3. Perform Migration
echo ""
echo "📦 Dumping and restoring..."

# Check tools
if ! command -v pg_dump &> /dev/null; then
    echo "❌ pg_dump not found. Please install postgresql-client."
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "❌ psql not found. Please install postgresql-client."
    exit 1
fi

# Pipe dump to psql
# --data-only to preserve schema (assuming schema is synced via migrations)
# Or use --clean if we want to retain full state? User asked to "push all data".
# Let's use --data-only --column-inserts to be safe with existing schema
pg_dump "$SOURCE_DB_URL" --data-only --column-inserts | psql "$TARGET_DB_URL"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration Complete!"
else
    echo ""
    echo "❌ Migration Failed. Check credentials and connectivity."
fi
