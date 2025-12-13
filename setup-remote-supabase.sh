#!/bin/bash

# AgentiFi Remote Supabase Setup Script
# This script helps you connect to a remote Supabase project

echo "🌐 AgentiFi - Remote Supabase Setup"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Available Supabase Projects:${NC}"
echo ""
echo "1. onecrm (raiievlmdkrahrqusxba)"
echo "2. supabase-red-onecrm (pqqyfjexiwjrzhdrlzju)"
echo "3. NitinBag0riya's Project (mwmwqwljakgpyulthkma)"
echo "4. Create a new project"
echo ""

read -p "Choose a project (1-4): " choice

case $choice in
  1)
    PROJECT_REF="raiievlmdkrahrqusxba"
    PROJECT_NAME="onecrm"
    ;;
  2)
    PROJECT_REF="pqqyfjexiwjrzhdrlzju"
    PROJECT_NAME="supabase-red-onecrm"
    ;;
  3)
    PROJECT_REF="mwmwqwljakgpyulthkma"
    PROJECT_NAME="NitinBag0riya's Project"
    ;;
  4)
    echo ""
    echo -e "${YELLOW}Creating a new project...${NC}"
    read -p "Enter project name: " PROJECT_NAME
    echo ""
    echo "Creating project: $PROJECT_NAME"
    supabase projects create "$PROJECT_NAME" --region ap-south-1
    echo ""
    echo -e "${GREEN}✅ Project created!${NC}"
    echo "Please run this script again to link to the new project."
    exit 0
    ;;
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${BLUE}Selected: ${PROJECT_NAME} (${PROJECT_REF})${NC}"
echo ""

# Link the project
echo -e "${YELLOW}Linking to Supabase project...${NC}"
supabase link --project-ref "$PROJECT_REF"

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to link project${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Project linked successfully!${NC}"
echo ""

# Get database info
echo -e "${YELLOW}Fetching database connection details...${NC}"
echo ""
supabase db show

echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
echo "2. Copy your database password (or reset it if needed)"
echo "3. Update your .env file with:"
echo ""
echo -e "${GREEN}DATABASE_URL=postgresql://postgres.${PROJECT_REF}:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true${NC}"
echo ""
echo "4. Get your API keys from: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
echo "5. Update these in .env:"
echo ""
echo -e "${GREEN}SUPABASE_URL=https://${PROJECT_REF}.supabase.co${NC}"
echo -e "${GREEN}SUPABASE_ANON_KEY=[your-anon-key]${NC}"
echo -e "${GREEN}SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]${NC}"
echo ""
echo "6. Restart your app: bun run dev"
echo ""
echo -e "${BLUE}Opening Supabase Dashboard...${NC}"
open "https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
