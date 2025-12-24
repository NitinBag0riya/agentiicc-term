#!/bin/bash

# ============================================================================
# AgentiFi Bot - AWS EC2 Setup Script
# For Amazon Linux 2023 / Ubuntu 22.04
# ============================================================================
# 
# Usage:
#   chmod +x setup-aws.sh
#   ./setup-aws.sh
#
# This script will:
#   1. Install all system dependencies (Node.js, Bun, Redis, PM2, ngrok)
#   2. Configure environment variables
#   3. Start Redis server
#   4. Deploy bot with webhook URL auto-injection
#   5. Serve tg-mini-webapp
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "============================================"
echo "  🚀 AgentiFi Bot - AWS EC2 Setup"
echo "============================================"
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS="unknown"
fi
log "Detected OS: $OS"

# Get project root (script location)
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
log "Project root: $PROJECT_ROOT"

# ============================================================================
# 1. SYSTEM DEPENDENCIES
# ============================================================================
echo ""
echo "📦 Installing system dependencies..."

if [[ "$OS" == "amzn" || "$OS" == "rhel" || "$OS" == "centos" ]]; then
    # Amazon Linux / RHEL / CentOS
    sudo yum update -y
    sudo yum install -y git curl wget unzip gcc-c++ make
    
    # Install Node.js 20
    if ! command -v node &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    fi
    
    # Install Redis
    if ! command -v redis-server &> /dev/null; then
        sudo yum install -y redis6 || sudo amazon-linux-extras install redis6 -y || sudo yum install -y redis
        sudo systemctl enable redis
        sudo systemctl start redis
    fi
    
elif [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    # Ubuntu / Debian
    sudo apt-get update -y
    sudo apt-get install -y git curl wget unzip build-essential
    
    # Install Node.js 20
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install Redis
    if ! command -v redis-server &> /dev/null; then
        sudo apt-get install -y redis-server
        sudo systemctl enable redis-server
        sudo systemctl start redis-server
    fi
else
    warn "Unknown OS. Please install Node.js 20+, Redis manually."
fi

log "Node.js version: $(node --version)"
log "npm version: $(npm --version)"

# ============================================================================
# 2. INSTALL BUN
# ============================================================================
echo ""
echo "📦 Installing Bun..."

if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
    
    # Add to PATH for current session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    # Add to shell profile
    SHELL_RC="$HOME/.bashrc"
    if [ -f "$HOME/.zshrc" ]; then
        SHELL_RC="$HOME/.zshrc"
    fi
    
    if ! grep -q "BUN_INSTALL" "$SHELL_RC"; then
        echo 'export BUN_INSTALL="$HOME/.bun"' >> "$SHELL_RC"
        echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$SHELL_RC"
    fi
fi
log "Bun version: $(bun --version)"

# ============================================================================
# 3. INSTALL PM2
# ============================================================================
echo ""
echo "📦 Installing PM2..."

if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi
log "PM2 version: $(pm2 --version)"

# ============================================================================
# 4. INSTALL NGROK
# ============================================================================
echo ""
echo "📦 Installing ngrok..."

if ! command -v ngrok &> /dev/null; then
    if [[ "$(uname -m)" == "x86_64" ]]; then
        NGROK_URL="https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz"
    else
        NGROK_URL="https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz"
    fi
    
    wget -q "$NGROK_URL" -O /tmp/ngrok.tgz
    sudo tar -xzf /tmp/ngrok.tgz -C /usr/local/bin
    rm /tmp/ngrok.tgz
fi
log "ngrok installed"

# ============================================================================
# 5. VERIFY REDIS IS RUNNING
# ============================================================================
echo ""
echo "🔄 Verifying Redis..."

if command -v redis-cli &> /dev/null; then
    if redis-cli ping 2>/dev/null | grep -q "PONG"; then
        log "Redis is running"
    else
        warn "Starting Redis..."
        sudo systemctl start redis 2>/dev/null || sudo systemctl start redis-server 2>/dev/null || redis-server --daemonize yes
    fi
else
    error "Redis not installed. Please install redis-server."
fi

# ============================================================================
# 6. INSTALL PROJECT DEPENDENCIES
# ============================================================================
echo ""
echo "📦 Installing project dependencies..."

cd "$PROJECT_ROOT"
bun install

log "Dependencies installed"

# ============================================================================
# 7. ENVIRONMENT CONFIGURATION
# ============================================================================
echo ""
echo "🔧 Configuring environment..."

if [ ! -f "$PROJECT_ROOT/.env" ]; then
    if [ -f "$PROJECT_ROOT/.example-env" ]; then
        cp "$PROJECT_ROOT/.example-env" "$PROJECT_ROOT/.env"
        log "Created .env from .example-env"
    elif [ -f "$PROJECT_ROOT/.env.example" ]; then
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        log "Created .env from .env.example"
    else
        error "No .env template found. Please create .env manually."
    fi
fi

# Get AWS public IP for webhook
AWS_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || curl -s ifconfig.me)
log "Public IP: $AWS_PUBLIC_IP"

# Get PORT from .env or default to 3000
PORT=$(grep "^PORT=" "$PROJECT_ROOT/.env" | cut -d '=' -f2 | tr -d '[:space:]' || echo "3000")
if [ -z "$PORT" ]; then PORT="3000"; fi
log "Using port: $PORT"

# Check required env vars
REQUIRED_VARS=("TELEGRAM_BOT_TOKEN" "DATABASE_URL" "ENCRYPTION_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=.\+" "$PROJECT_ROOT/.env" 2>/dev/null || grep -q "^${var}=your_" "$PROJECT_ROOT/.env" 2>/dev/null; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo ""
    warn "Missing or incomplete environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    warn "Please edit .env and add these values before continuing."
    echo "   nano $PROJECT_ROOT/.env"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# ============================================================================
# 8. CLEANUP EXISTING PROCESSES
# ============================================================================
echo ""
echo "🧹 Cleaning up existing processes..."

pm2 delete all 2>/dev/null || true
sudo fuser -k $PORT/tcp 2>/dev/null || true
sudo fuser -k 5173/tcp 2>/dev/null || true

# ============================================================================
# 9. GENERATE PM2 ECOSYSTEM CONFIG
# ============================================================================
echo ""
echo "📝 Generating PM2 ecosystem config..."

cat > "$PROJECT_ROOT/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: "agentifi-bot",
      script: "npm",
      args: "run start",
      cwd: "$PROJECT_ROOT",
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: "production",
        PORT: "$PORT"
      }
    },
    {
      name: "agentifi-ngrok",
      script: "ngrok",
      args: "http $PORT --log=stdout",
      cwd: "$PROJECT_ROOT",
      autorestart: true,
      max_restarts: 10
    },
    {
      name: "agentifi-webapp",
      script: "npx",
      args: "serve tg-mini-webapp -l 5173 -s",
      cwd: "$PROJECT_ROOT",
      autorestart: true
    }
  ]
};
EOF

log "PM2 config generated"

# Install serve for static file hosting
npm install -g serve 2>/dev/null || true

# ============================================================================
# 10. CHECK NGROK AUTH TOKEN
# ============================================================================
echo ""
echo "🔐 Checking ngrok authentication..."

if [ -z "$(ngrok config check 2>&1 | grep -i 'valid')" ]; then
    warn "ngrok auth token may not be configured."
    echo "   Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo ""
    read -p "Enter ngrok auth token (or press Enter to skip): " NGROK_TOKEN
    if [ -n "$NGROK_TOKEN" ]; then
        ngrok config add-authtoken "$NGROK_TOKEN"
        log "ngrok token configured"
    fi
fi

# ============================================================================
# 11. START SERVICES
# ============================================================================
echo ""
echo "🚀 Starting services..."

pm2 start "$PROJECT_ROOT/ecosystem.config.cjs"

# Wait for ngrok to start
echo ""
echo "⏳ Waiting for ngrok tunnel..."
sleep 8

# Get ngrok URL
NGROK_URL=""
for i in {1..5}; do
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*\.ngrok-free\.app' | head -1)
    if [ -n "$NGROK_URL" ]; then
        break
    fi
    sleep 2
done

if [ -n "$NGROK_URL" ]; then
    log "ngrok URL: $NGROK_URL"
    
    # Update .env with webhook URL
    if grep -q "^WEBHOOK_URL=" "$PROJECT_ROOT/.env"; then
        sed -i "s|^WEBHOOK_URL=.*|WEBHOOK_URL=$NGROK_URL|" "$PROJECT_ROOT/.env"
    else
        echo "WEBHOOK_URL=$NGROK_URL" >> "$PROJECT_ROOT/.env"
    fi
    
    # Update MINI_APP_URL to use ngrok for the webapp
    MINI_APP_URL="$NGROK_URL/mini-app/index.html"
    if grep -q "^MINI_APP_URL=" "$PROJECT_ROOT/.env"; then
        sed -i "s|^MINI_APP_URL=.*|MINI_APP_URL=$MINI_APP_URL|" "$PROJECT_ROOT/.env"
    else
        echo "MINI_APP_URL=$MINI_APP_URL" >> "$PROJECT_ROOT/.env"
    fi
    
    log "Updated WEBHOOK_URL in .env"
    log "Updated MINI_APP_URL in .env"
    
    # Restart bot to pick up new URLs
    echo "🔄 Restarting bot with new webhook..."
    pm2 restart agentifi-bot
else
    warn "Could not get ngrok URL automatically."
    warn "Check: curl http://localhost:4040/api/tunnels"
    warn "Then update WEBHOOK_URL in .env manually and run: pm2 restart agentifi-bot"
fi

# Save PM2 config
pm2 save --force

# Setup PM2 startup script
echo ""
echo "🔧 Setting up PM2 startup..."
pm2 startup 2>/dev/null | tail -1 | sudo bash 2>/dev/null || true

# ============================================================================
# 12. FINAL STATUS
# ============================================================================
echo ""
echo "============================================"
echo "  ✅ Deployment Complete!"
echo "============================================"
echo ""
echo "📊 Services Status:"
pm2 status
echo ""
echo "📍 Endpoints:"
echo "   Bot API:    http://localhost:$PORT"
echo "   Health:     http://localhost:$PORT/health"
echo "   Mini App:   http://localhost:5173"
if [ -n "$NGROK_URL" ]; then
    echo "   Webhook:    $NGROK_URL/webhook"
    echo "   Public App: $NGROK_URL/mini-app/"
fi
echo ""
echo "📊 Useful Commands:"
echo "   pm2 logs              # View all logs"
echo "   pm2 logs agentifi-bot # View bot logs"
echo "   pm2 monit             # Monitor processes"
echo "   pm2 restart all       # Restart all services"
echo ""
echo "🔧 To update webhook URL manually:"
echo "   1. Edit .env: nano $PROJECT_ROOT/.env"
echo "   2. Restart: pm2 restart agentifi-bot"
echo ""
