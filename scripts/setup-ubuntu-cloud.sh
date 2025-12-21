#!/bin/bash
set -e

# AgentiFi Ubuntu Cloud Setup Script
# This script provisions a fresh Ubuntu server with all dependencies needed to run AgentiFi.

echo "🚀 Starting AgentiFi Cloud Setup..."
echo "-----------------------------------"

# 1. System Updates & Essentials
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip build-essential

# 2. Install Database Services (PostgreSQL & Redis)
echo "🗄️  Installing Databases..."
sudo apt install -y postgresql postgresql-contrib redis-server

# Start and Enable Services
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl start redis-server
sudo systemctl enable redis-server

echo "✅ Databases installed and running."

# 3. Install Bun Runtime
if ! command -v bun &> /dev/null; then
    echo "🍞 Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    
    # Add to path for current session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    # Make accessible globally (symlink)
    if [ ! -f /usr/local/bin/bun ]; then
        sudo ln -s $HOME/.bun/bin/bun /usr/local/bin/bun
    fi
else
    echo "✅ Bun is already installed."
fi

# 4. Project Setup
echo "🔧 Setting up Project..."

# Check if we are running inside the repo
if [ ! -f "package.json" ]; then
    echo "⚠️  package.json not found. Are you in the project root?"
    echo "   Cloning from git is recommended if this is an empty folder."
    # Optional: Prompt to clone if user wants
    # read -p "Enter Git Repo URL to clone (or press enter to skip): " REPO_URL
    # if [ ! -z "$REPO_URL" ]; then
    #    git clone $REPO_URL agentifi
    #    cd agentifi
    # fi
else
    echo "📂 Project detected."
fi

# Install dependencies
echo "📦 Installing Node dependencies via Bun..."
bun install

# Environment Setup
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        touch .env
        echo "TELEGRAM_BOT_TOKEN=" >> .env
        echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agentifi" >> .env
        echo "REDIS_URL=redis://localhost:6379" >> .env
    fi
    echo "⚠️  Action Required: Please edit .env with your actual credentials!"
fi

# 5. Systemd Service Setup (Auto-Start)
echo "⚙️  Configuring Systemd Service..."

SERVICE_NAME="agentifi"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
CURRENT_USER=$(whoami)
PROJECT_DIR=$(pwd)
BUN_PATH=$(which bun)

# Create service file
sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=AgentiFi Trading Bot
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${PROJECT_DIR}
ExecStart=${BUN_PATH} src/index.ts
Restart=always
RestartSec=10
EnvironmentFile=${PROJECT_DIR}/.env

[Install]
WantedBy=multi-user.target
EOL

# Reload init daemon
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}

echo "✅ Systemd service configured: ${SERVICE_NAME}"

echo "
🎉 SETUP COMPLETE!

Next Steps:
1. 📝 Edit your configuration:
   nano .env

2. ▶️  Start the bot:
   sudo systemctl start agentifi

3. 📜 View logs:
   sudo journalctl -u agentifi -f
"
