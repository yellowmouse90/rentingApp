#!/bin/bash

# Setup script for chat feature
# This script helps set up the chat feature database schema

set -e

echo "🚀 Chat Feature Setup Script"
echo "=============================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found"
    echo "Please create .env.local with Supabase credentials"
    exit 1
fi

echo "📋 Step 1: Reading Supabase credentials..."
source .env.local

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: Missing Supabase credentials"
    exit 1
fi

echo "✅ Supabase credentials found"
echo ""

echo "📋 Step 2: Running database migration..."
echo "You need to run the SQL migration manually in Supabase:"
echo ""
echo "1. Go to https://app.supabase.com"
echo "2. Open your project"
echo "3. Go to SQL Editor"
echo "4. Create a new query"
echo "5. Copy the contents of: db/migrations/001_create_interactions_schema.sql"
echo "6. Run the query"
echo ""
echo "Alternatively, use Supabase CLI:"
echo "  supabase db push"
echo ""

echo "📋 Step 3: Verifying schema..."
echo "After running the migration, verify with:"
echo ""
echo "  SELECT table_name FROM information_schema.tables"
echo "  WHERE table_schema = 'interactions_domain'"
echo "  ORDER BY table_name;"
echo ""

echo "✅ Setup instructions completed!"
echo ""
echo "Next steps:"
echo "1. Apply the SQL migration in Supabase"
echo "2. Run: npm run dev"
echo "3. Test by:"
echo "   - Going to a booking detail page"
echo "   - Clicking 'Invia messaggio'"
echo "   - Sending a message"
echo ""
echo "📚 For more information, see CHAT_FEATURE.md"
