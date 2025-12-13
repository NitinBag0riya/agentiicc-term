#!/bin/bash

# Backup Remote Database

# 1. Load .env
# Resolve project root (one level up from this script)
PROJECT_ROOT="$(dirname "$0")/.."
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo "❌ .env file not found at $ENV_FILE!"
    exit 1
fi

# 2. Prepare Connection String
# Strip ?pgbouncer=true or other params that pg_dump might dislike in some versions,
# OR Keep them if the installed pg_dump supports them. 
# The error 'invalid URI query parameter: "pgbouncer"' indicates current psql/libpq doesn't support it.
CLEAN_DB_URL=$(echo "$DATABASE_URL" | sed 's/?pgbouncer=true//g' | sed 's/&pgbouncer=true//g')

echo "🚀 Backing up Database..."
echo "Target: $CLEAN_DB_URL"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# 3. Dump
echo "   ...using connection string (redacted)..."

if command -v docker &> /dev/null; then
    echo "🐳 Docker detected. Using 'postgres:15' container to match server version..."
    # Run pg_dump via Docker (ephemeral container)
    # We pass the DB URL environment variable to avoid logging it in process list (mostly)
    # Mapping current directory to /backup in container to write file
    docker run --rm \
        -v "$(pwd)/$BACKUP_DIR:/backup" \
        -e DB_URL="$CLEAN_DB_URL" \
        postgres:15 \
        bash -c "pg_dump \"\$DB_URL\" --format=plain --no-owner --no-acl > /backup/db_backup_$TIMESTAMP.sql"
    
    EXIT_CODE=$?
    
    # Check if docker command actually produced the file (it connects inside container path to host path)
    # Filename inside container was /backup/..., which maps to $(pwd)/$BACKUP_DIR/...
    # So we don't need to move it.
else
    echo "⚠️  Docker not found. Attempting local 'pg_dump'..."
    pg_dump "$CLEAN_DB_URL" --format=plain --no-owner --no-acl > "$BACKUP_FILE"
    EXIT_CODE=$?
fi

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Backup created: $BACKUP_FILE"
else
    echo "❌ Backup Failed."
    # Remove empty file
    rm -f "$BACKUP_FILE"
fi
