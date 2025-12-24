#!/bin/bash

# ============================================================================
# AgentiFi - One-Click AWS Deployment Script
# ============================================================================
# 
# This script deploys the bot to your AWS EC2 instance
# Run from your local machine (Mac)
# ============================================================================

set -e

# Configuration
EC2_IP="13.211.229.135"
EC2_USER="ec2-user"  # Change to "ubuntu" if using Ubuntu AMI
PEM_FILE="/Users/nitinbagoriya/Downloads/probe_awsKey.pem"
PROJECT_DIR="/Users/nitinbagoriya/Downloads/Archive"
REMOTE_DIR="~/agentiicc-term"
BRANCH="iceberg"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "============================================"
echo "  🚀 AgentiFi - AWS Deployment"
echo "============================================"
echo ""
echo "  EC2 IP:    $EC2_IP"
echo "  User:      $EC2_USER"
echo "  Branch:    $BRANCH"
echo ""

# Check PEM file exists
if [ ! -f "$PEM_FILE" ]; then
    error "PEM file not found: $PEM_FILE"
fi

# Fix PEM permissions
chmod 400 "$PEM_FILE"
log "PEM file permissions set"

# Test SSH connection
echo ""
echo "🔌 Testing SSH connection..."
if ! ssh -i "$PEM_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" "echo 'SSH OK'" 2>/dev/null; then
    # Try ubuntu user if ec2-user fails
    EC2_USER="ubuntu"
    warn "Trying ubuntu user..."
    if ! ssh -i "$PEM_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" "echo 'SSH OK'" 2>/dev/null; then
        error "Cannot connect to EC2. Check IP, security group, and PEM file."
    fi
fi
log "SSH connection successful (user: $EC2_USER)"

# Deploy to EC2
echo ""
echo "🚀 Deploying to EC2..."

ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << 'REMOTE_SCRIPT'
set -e

echo "🧹 CLEANUP: Killing all existing processes..."

# Kill PM2 processes
pm2 kill 2>/dev/null || true

# Kill bot-related processes only (not SSH)
sudo pkill -9 -f "bun run" 2>/dev/null || true
sudo pkill -9 -f "ngrok" 2>/dev/null || true

# Kill processes on common ports
sudo fuser -k 3000/tcp 2>/dev/null || true
sudo fuser -k 3742/tcp 2>/dev/null || true
sudo fuser -k 5173/tcp 2>/dev/null || true
sudo fuser -k 4040/tcp 2>/dev/null || true

sleep 2
echo "✅ Cleanup complete"

echo "📦 Installing system dependencies..."

# Detect OS and install deps
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
fi

if [[ "$OS" == "amzn" ]]; then
    sudo yum update -y
    sudo yum install -y git curl wget
    
    # Install Node.js 20
    if ! command -v node &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    fi
    
    # Install Redis
    if ! command -v redis-server &> /dev/null; then
        sudo yum install -y redis6 || sudo amazon-linux-extras install redis6 -y || sudo yum install -y redis
    fi
    sudo systemctl enable redis 2>/dev/null || true
    sudo systemctl start redis 2>/dev/null || true
    
elif [[ "$OS" == "ubuntu" ]]; then
    sudo apt-get update -y
    sudo apt-get install -y git curl wget
    
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    if ! command -v redis-server &> /dev/null; then
        sudo apt-get install -y redis-server
    fi
    sudo systemctl enable redis-server 2>/dev/null || true
    sudo systemctl start redis-server 2>/dev/null || true
fi

# Install Bun
if ! command -v bun &> /dev/null; then
    echo "📦 Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
fi
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Install ngrok
if ! command -v ngrok &> /dev/null; then
    echo "📦 Installing ngrok..."
    if [[ "$(uname -m)" == "x86_64" ]]; then
        wget -q "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz" -O /tmp/ngrok.tgz
    else
        wget -q "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz" -O /tmp/ngrok.tgz
    fi
    sudo tar -xzf /tmp/ngrok.tgz -C /usr/local/bin
    rm /tmp/ngrok.tgz
fi

# Install serve for static files
sudo npm install -g serve 2>/dev/null || true

echo "✅ System dependencies installed"
REMOTE_SCRIPT

log "System dependencies installed on EC2"

# Clone/update repo
echo ""
echo "📥 Setting up repository..."

ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << REMOTE_SCRIPT
set -e
export BUN_INSTALL="\$HOME/.bun"
export PATH="\$BUN_INSTALL/bin:\$PATH"

if [ -d "$REMOTE_DIR" ]; then
    echo "Updating existing repo..."
    cd $REMOTE_DIR
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
else
    echo "Cloning repo..."
    git clone https://github.com/NitinBag0riya/agentiicc-term.git $REMOTE_DIR
    cd $REMOTE_DIR
    git checkout $BRANCH
fi

echo "📦 Installing project dependencies..."
bun install

echo "✅ Repository ready"
REMOTE_SCRIPT

log "Repository setup complete"

# Copy .env file
echo ""
echo "📄 Copying .env file..."

if [ -f "$PROJECT_DIR/.env" ]; then
    scp -i "$PEM_FILE" -o StrictHostKeyChecking=no "$PROJECT_DIR/.env" "$EC2_USER@$EC2_IP:$REMOTE_DIR/.env"
    log ".env file copied to EC2"
else
    warn ".env file not found locally. You'll need to create it on the server."
fi

# Start services
echo ""
echo "🚀 Starting services..."

ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << 'REMOTE_SCRIPT'
set -e
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

cd ~/agentiicc-term

# Stop existing processes
pm2 delete all 2>/dev/null || true

# Get port from .env
PORT=$(grep "^PORT=" .env 2>/dev/null | cut -d '=' -f2 | tr -d '[:space:]' || echo "3000")
if [ -z "$PORT" ]; then PORT="3000"; fi

# Generate PM2 config
cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [
    {
      name: "agentifi-bot",
      script: "npm",
      args: "run start",
      cwd: "$HOME/agentiicc-term",
      autorestart: true,
      max_memory_restart: '1G',
      env: { NODE_ENV: "production", PORT: "$PORT" }
    },
    {
      name: "agentifi-ngrok",
      script: "ngrok",
      args: "http $PORT --log=stdout",
      cwd: "$HOME/agentiicc-term",
      autorestart: true
    },
    {
      name: "agentifi-webapp",
      script: "npx",
      args: "serve tg-mini-webapp -l 5173 -s",
      cwd: "$HOME/agentiicc-term",
      autorestart: true
    }
  ]
};
EOF

# Start PM2
pm2 start ecosystem.config.cjs
pm2 save --force

# Wait for ngrok
echo "⏳ Waiting for ngrok..."
sleep 8

# Get ngrok URL and update .env
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*\.ngrok-free\.app' | head -1)

if [ -n "$NGROK_URL" ]; then
    echo "✅ ngrok URL: $NGROK_URL"
    
    # Update .env
    sed -i "s|^WEBHOOK_URL=.*|WEBHOOK_URL=$NGROK_URL|" .env 2>/dev/null || echo "WEBHOOK_URL=$NGROK_URL" >> .env
    sed -i "s|^MINI_APP_URL=.*|MINI_APP_URL=$NGROK_URL/mini-app/index.html|" .env 2>/dev/null || echo "MINI_APP_URL=$NGROK_URL/mini-app/index.html" >> .env
    
    # Restart bot with new webhook
    pm2 restart agentifi-bot
    echo "✅ Webhook URL updated and bot restarted"
else
    echo "⚠️ ngrok URL not available. Check: curl http://localhost:4040/api/tunnels"
fi

# Setup startup script
pm2 startup 2>/dev/null | tail -1 | sudo bash 2>/dev/null || true

# Show status
echo ""
pm2 status
REMOTE_SCRIPT

# Final status
echo ""
echo "============================================"
echo "  ✅ Deployment Complete!"
echo "============================================"
echo ""
echo "📍 Your bot is now running on EC2!"
echo ""
echo "🔧 Useful commands (run via SSH):"
echo "   ssh -i \"$PEM_FILE\" $EC2_USER@$EC2_IP"
echo ""
echo "   pm2 logs              # View logs"
echo "   pm2 status            # Check status"
echo "   pm2 restart all       # Restart services"
echo "   ./update.sh           # Pull latest changes"
echo ""
