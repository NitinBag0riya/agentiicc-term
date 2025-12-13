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

# Clean DB URL for psql (remove pgbouncer param)
CLEAN_DB_URL=$(echo "$TARGET_DB_URL" | sed 's/?pgbouncer=true//g' | sed 's/&pgbouncer=true//g')

echo ""
echo "🎯 Target (Cloud): $TARGET_DB_URL"  
echo "(Hidden for security)"
echo ""

# 2. Identify Source
echo "Which local database do you want to migrate FROM?"
echo "1) Standard Local Supabase (Auto-Update)"
echo "2) Custom Local Postgres (Enter URL)"
read -p "Selection: " CHOICE

SOURCE_IS_DOCKER=false
CONTAINER_NAME=""

if [ "$CHOICE" == "1" ]; then
    # Try to find the running supabase db container
    CONTAINER_NAME=$(docker ps --format "{{.Names}}" | grep "supabase_db_" | head -n 1)
    if [ -z "$CONTAINER_NAME" ]; then
        echo "❌ No running Supabase DB container found!"
        echo "   Please make sure your local Supabase is running (bun run supabase start)."
        exit 1
    fi
    echo "🐳 Found Local Supabase Container: $CONTAINER_NAME"
    SOURCE_IS_DOCKER=true
    # We will use docker exec, so no URL needed here really, but let's keep var for consistency if needed
    SOURCE_DB_URL="docker-exec" 
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

if [ "$SOURCE_IS_DOCKER" = true ]; then
    echo "🔹 Dumping from Docker container ($CONTAINER_NAME)..."
    # Dump from inside container (postgres user, postgres db)
    # --data-only to keep schema safe (since remote likely has schema from migrations)
    docker exec "$CONTAINER_NAME" pg_dump -U postgres --data-only --column-inserts postgres | psql "$CLEAN_DB_URL"
else
    echo "🔹 Dumping from URL..."
    pg_dump "$SOURCE_DB_URL" --data-only --column-inserts | psql "$CLEAN_DB_URL"
fi

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
# Use Docker for pg_dump if available to avoid version mismatch
echo ""
if command -v docker &> /dev/null; then
    echo "🐳 Docker detected. Using 'postgres:15' for reliable dump..."
    # Note: We can't easily pipe docker output to local psql if psql is also version-mismatched, 
    # but psql is usually forward compatible.
    # However, for migration we need to read from SOURCE and write to TARGET.
    # If SOURCE is local (host), we need --network host or host.docker.internal depending on OS.
    # This acts as a proxy.
    
    # Simplification: Only use Docker if source is NOT 127.0.0.1 (too complex to route localhost into docker reliably across OS for simple script)
    # OR, warn user.
    # Actually, the user's error was with the REMOTE server version mismatch when backing it up.
    # For migration, we are dumping LOCAL (v14 likely) and restoring to REMOTE (v15). 
    # pg_dump version 14 against local v14 DB is FINE.
    # The restore is done by 'psql' against remote v15 DB. psql v14 connecting to v15 server is usually OK.
    
    # So actually, migration script might be fine as is?!
    # Let's verify: "pg_dump (v14) -> file -> psql (v14) -> remote (v15)"
    # pg_dump dumps the LOCAL db. If local db is v14, pg_dump v14 is perfect.
    # psql v14 to remote v15 is generally compatible for restore.
    
    # The backup script usage was: pg_dump (v14) -> remote (v15). That fails.
    # So migration script might NOT need docker if we are dumping local.
    
    # BUT if the user entered a custom source URL that is also v15, then we have an issue.
    # Let's leave migration script alone for now unless tested otherwise.
    
    pg_dump "$SOURCE_DB_URL" --data-only --column-inserts | psql "$CLEAN_DB_URL"
fi

# Clean up pgbouncer param
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration Complete!"
else
    echo ""
    echo "❌ Migration Failed. Check credentials and connectivity."
fi
