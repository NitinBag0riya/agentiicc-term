#!/bin/bash

# Update Database (Apply SQL)

# 1. Load .env
# Resolve project root
PROJECT_ROOT="$(dirname "$0")/.."
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo "❌ .env file not found at $ENV_FILE!"
    exit 1
fi

CLEAN_DB_URL=$(echo "$DATABASE_URL" | sed 's/?pgbouncer=true//g' | sed 's/&pgbouncer=true//g')

echo "🚀 Database Update Tool"
echo "Target: $CLEAN_DB_URL"
echo ""
echo "Select update mode:"
echo "1) Run 'src/db/schema.sql' (if exists)"
echo "2) Apply a specific SQL file"
echo "3) Enter SQL query manually"
read -p "Choice: " CHOICE

CMD=""

if [ "$CHOICE" == "1" ]; then
    if [ -f "src/db/schema.sql" ]; then
        CMD="src/db/schema.sql"
    else
        echo "❌ src/db/schema.sql not found."
        exit 1
    fi
elif [ "$CHOICE" == "2" ]; then
    read -p "Enter path to SQL file: " SQL_FILE
    if [ -f "$SQL_FILE" ]; then
        CMD="$SQL_FILE"
    else
        echo "❌ File not found."
        exit 1
    fi
elif [ "$CHOICE" == "3" ]; then
    read -p "Enter SQL query: " QUERY
    echo ""
    psql "$CLEAN_DB_URL" -c "$QUERY"
    exit $?
else
    echo "Invalid choice."
    exit 1
fi

if [ -n "$CMD" ]; then
    echo "Applying $CMD..."
    psql "$CLEAN_DB_URL" -f "$CMD"
fi

if [ $? -eq 0 ]; then
    echo "✅ Update executed successfully."
else
    echo "❌ Update failed."
fi
