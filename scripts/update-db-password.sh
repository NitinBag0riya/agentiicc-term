#!/bin/bash

# Script to update DATABASE_URL with your Supabase password

echo "🔐 Supabase Database Password Setup"
echo "===================================="
echo ""
echo "This script will help you update the DATABASE_URL in your .env file."
echo ""
echo "📋 Steps:"
echo "1. The Supabase dashboard should be open in your browser"
echo "2. Go to: Settings → Database"
echo "3. Find 'Database Password' section"
echo "4. Copy your password (or reset it if needed)"
echo ""
read -p "Enter your Supabase database password: " -s DB_PASSWORD
echo ""
echo ""

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Password cannot be empty"
    exit 1
fi

# Update DATABASE_URL in .env
sed -i.bak "s|\[YOUR-DB-PASSWORD\]|$DB_PASSWORD|g" .env

if [ $? -eq 0 ]; then
    echo "✅ DATABASE_URL updated successfully!"
    echo ""
    echo "Testing connection..."
    
    # Test the connection
    export $(cat .env | grep DATABASE_URL | xargs)
    psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Database connection successful!"
        echo ""
        echo "🎉 All set! You can now run your app:"
        echo "   bun run dev"
    else
        echo "❌ Database connection failed. Please check your password."
        echo ""
        echo "You can manually edit .env and update the DATABASE_URL"
    fi
else
    echo "❌ Failed to update .env file"
    exit 1
fi

echo ""
echo "📝 Your remote Supabase URLs:"
echo "   Dashboard: https://supabase.com/dashboard/project/raiievlmdkrahrqusxba"
echo "   API URL: https://raiievlmdkrahrqusxba.supabase.co"
echo ""
