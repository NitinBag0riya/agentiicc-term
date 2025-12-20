#!/bin/bash

# Database Migration: Fix Multi-Exchange Support
# This script fixes the api_credentials table to allow multiple exchanges per user

echo "🔄 Database Migration: Multi-Exchange Support"
echo "=============================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env"
    exit 1
fi

echo "📊 Connecting to database..."
echo ""

# Run migration SQL
psql "$DATABASE_URL" << 'EOF'
-- Drop the old constraint if it exists
ALTER TABLE api_credentials DROP CONSTRAINT IF EXISTS api_credentials_user_id_key;
ALTER TABLE api_credentials DROP CONSTRAINT IF EXISTS apicredentialsuseridkey;

-- Ensure the correct unique constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'api_credentials_user_id_exchange_id_key'
    ) THEN
        ALTER TABLE api_credentials 
        ADD CONSTRAINT api_credentials_user_id_exchange_id_key 
        UNIQUE (user_id, exchange_id);
    END IF;
END $$;

-- Verify the constraint
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'api_credentials'::regclass
AND contype = 'u';

EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "You can now link multiple exchanges per user."
else
    echo ""
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi
