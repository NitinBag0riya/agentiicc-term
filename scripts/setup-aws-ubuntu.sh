#!/bin/bash
set -e

# AgentiFi AWS Ubuntu Setup Script
# Configures a generic Ubuntu server on AWS for the AgentiFi Trading Bot.
# Handles: System deps, Node.js, Bun, PostgreSQL, Redis, Project deps, and Systemd Service.

echo "🚀 Starting AgentiFi AWS Setup..."
echo "---------------------------------"

# 1. System Updates & Essentials
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip build-essential jq

# 2. Install Node.js (LTS) - Requested by User
if ! command -v node &> /dev/null; then
    echo "🟢 Installing Node.js LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "   Node $(node -v) installed."
else
    echo "✅ Node.js already installed: $(node -v)"
fi

# 3. Install Redis (Session Storage)
echo "🗄️  Installing Redis..."
sudo apt install -y redis-server

# Start and Enable Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

echo "✅ Redis installed and running."

# 4. Install Bun Runtime
if ! command -v bun &> /dev/null; then
    echo "🍞 Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    
    # Export for current session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    # Symlink for global access
    if [ ! -f /usr/local/bin/bun ]; then
        sudo ln -s $HOME/.bun/bin/bun /usr/local/bin/bun
    fi
else
    echo "✅ Bun is already installed: $(bun -v)"
fi

# 5. Connect/Setup Project
echo "🔧 Setting up Project..."

if [ ! -f "package.json" ]; then
    echo "⚠️  package.json not found."
    read -p "Enter Git Repo URL to clone (or press enter if you will upload manualy): " REPO_URL
    if [ ! -z "$REPO_URL" ]; then
       git clone $REPO_URL agentifi
       cd agentifi
    fi
fi

# 6. Install Project Dependencies
echo "📦 Installing Dependencies (Frozen Lockfile)..."
if [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
    bun install --frozen-lockfile
else
    echo "⚠️  No lockfile found. Installing generic..."
    bun install
fi

# 7. Configure Environment & AWS IP
echo "🌍 Configuring Network..."

# Try to detect AWS Public IP
AWS_IP=""
if curl --connect-timeout 2 -s http://169.254.169.254/latest/meta-data/public-ipv4 > aws_ip.txt; then
    AWS_IP=$(cat aws_ip.txt)
    rm aws_ip.txt
fi

if [ ! -z "$AWS_IP" ]; then
    echo "✅ Detected AWS Public IP: $AWS_IP"
    DEFAULT_WEBAPP_URL="https://$AWS_IP:3000"
else
    DEFAULT_WEBAPP_URL="https://YOUR_DOMAIN_OR_IP:3000"
fi

if [ ! -f .env ]; then
    echo "📝 Creating .env..."
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        touch .env
        echo "TELEGRAM_BOT_TOKEN=" >> .env
        echo "DATABASE_URL=postgresql://postgres:[PASSWORD]@[SUPABASE_HOST]:5432/postgres" >> .env
        echo "REDIS_URL=redis://localhost:6379" >> .env
    fi
    
    # Append/Update WEBAPP_URL
    if ! grep -q "WEBAPP_URL=" .env; then
        echo "WEBAPP_URL=$DEFAULT_WEBAPP_URL" >> .env
    fi

    # Append/Update WEBHOOK_URL (Required for "auto adding url" feature)
    if ! grep -q "WEBHOOK_URL=" .env; then
        echo "WEBHOOK_URL=$DEFAULT_WEBAPP_URL" >> .env
    fi

    # Generate Random Webhook Secret
    if ! grep -q "WEBHOOK_SECRET=" .env; then
        RANDOM_SECRET=$(openssl rand -hex 16)
        echo "WEBHOOK_SECRET=$RANDOM_SECRET" >> .env
    fi
    
    echo "⚠️  Action Required: Created .env. Please update TELEGRAM_BOT_TOKEN."
else
    echo "✅ .env exists."
fi

# 8. Setup Systemd Service
echo "⚙️  Configuring Systemd Service..."

SERVICE_NAME="agentifi"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
CURRENT_USER=$(whoami)
PROJECT_DIR=$(pwd)
BUN_PATH=$(which bun)

sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=AgentiFi Trading Bot
After=network.target redis-server.service

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

sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}

echo "
🎉 AWS UBUNTU SETUP COMPLETE!

Next Steps:
1. Edit .env:
   nano .env
   (Make sure TELEGRAM_BOT_TOKEN is set)

2. Start the App:
   sudo systemctl start agentifi

3. View Logs:
   sudo journalctl -u agentifi -f
"
