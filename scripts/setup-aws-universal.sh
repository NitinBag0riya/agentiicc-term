#!/bin/bash
set -e

# AgentiFi Universal AWS Setup Script
# Works on Ubuntu, Amazon Linux 2, Amazon Linux 2023, Debian, CentOS, RHEL
# With comprehensive error handling and fallback mechanisms

echo "🚀 Starting AgentiFi Universal Setup..."
echo "========================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Error handler
handle_error() {
    log_error "Script failed at line $1"
    exit 1
}
trap 'handle_error $LINENO' ERR

# ============================================
# 1. DETECT PACKAGE MANAGER
# ============================================
log_info "Detecting package manager..."

if command -v dnf &> /dev/null; then
    PKG_MAN="dnf"
    PKG_UPDATE="dnf update -y"
    PKG_INSTALL="dnf install -y"
    log_info "Detected: dnf (Amazon Linux 2023 / Fedora)"
elif command -v yum &> /dev/null; then
    PKG_MAN="yum"
    PKG_UPDATE="yum update -y"
    PKG_INSTALL="yum install -y"
    log_info "Detected: yum (Amazon Linux 2 / CentOS / RHEL)"
elif command -v apt-get &> /dev/null; then
    PKG_MAN="apt-get"
    PKG_UPDATE="apt-get update -y && apt-get upgrade -y"
    PKG_INSTALL="apt-get install -y"
    log_info "Detected: apt-get (Ubuntu / Debian)"
elif command -v apk &> /dev/null; then
    PKG_MAN="apk"
    PKG_UPDATE="apk update"
    PKG_INSTALL="apk add"
    log_info "Detected: apk (Alpine)"
else
    log_error "No supported package manager found!"
    exit 1
fi

# ============================================
# 2. SYSTEM UPDATE
# ============================================
log_info "Updating system packages..."
sudo $PKG_UPDATE || log_warn "System update had warnings (non-critical)"

# ============================================
# 3. INSTALL ESSENTIALS
# ============================================
log_info "Installing essential packages..."

if [ "$PKG_MAN" == "apt-get" ]; then
    sudo $PKG_INSTALL git curl unzip jq build-essential openssl
elif [ "$PKG_MAN" == "apk" ]; then
    sudo $PKG_INSTALL git curl unzip jq build-base openssl
else
    # dnf / yum
    sudo $PKG_INSTALL git curl unzip jq openssl
    sudo $PKG_MAN groupinstall -y "Development Tools" || log_warn "Development Tools group not available"
fi

# ============================================
# 4. INSTALL NODE.JS
# ============================================
if ! command -v node &> /dev/null; then
    log_info "Installing Node.js LTS (v20)..."
    
    if [ "$PKG_MAN" == "dnf" ]; then
        sudo dnf install -y nodejs || {
            log_warn "DNF nodejs failed, trying NodeSource..."
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo dnf install -y nodejs
        }
    elif [ "$PKG_MAN" == "yum" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    elif [ "$PKG_MAN" == "apt-get" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [ "$PKG_MAN" == "apk" ]; then
        sudo apk add nodejs npm
    fi
    
    log_info "Node.js $(node -v) installed"
else
    log_info "Node.js already installed: $(node -v)"
fi

# ============================================
# 5. INSTALL BUN
# ============================================
if ! command -v bun &> /dev/null; then
    log_info "Installing Bun runtime..."
    curl -fsSL https://bun.sh/install | bash
    
    # Add to PATH for current session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    # Create global symlink
    if [ ! -f /usr/local/bin/bun ]; then
        sudo ln -s "$HOME/.bun/bin/bun" /usr/local/bin/bun || log_warn "Could not create global bun symlink"
    fi
    
    log_info "Bun $(bun -v) installed"
else
    log_info "Bun already installed: $(bun -v)"
fi

# ============================================
# 6. INSTALL REDIS
# ============================================
log_info "Installing Redis..."

if [ "$PKG_MAN" == "apt-get" ]; then
    sudo apt-get install -y redis-server
    REDIS_SVC="redis-server"
elif [ "$PKG_MAN" == "apk" ]; then
    sudo apk add redis
    REDIS_SVC="redis"
else
    # dnf / yum - try multiple methods
    if command -v amazon-linux-extras &> /dev/null; then
        sudo amazon-linux-extras install redis6 -y || sudo $PKG_INSTALL redis
    else
        sudo $PKG_INSTALL redis6 || sudo $PKG_INSTALL redis
    fi
    REDIS_SVC="redis"
fi

# Start Redis
log_info "Starting Redis service..."
if command -v systemctl &> /dev/null; then
    # Detect actual service name
    if systemctl list-unit-files | grep -q "redis-server.service"; then
        REDIS_SVC="redis-server"
    elif systemctl list-unit-files | grep -q "redis.service"; then
        REDIS_SVC="redis"
    fi
    
    if sudo systemctl start $REDIS_SVC 2>/dev/null; then
        sudo systemctl enable $REDIS_SVC 2>/dev/null || log_warn "Could not enable $REDIS_SVC"
        log_info "Redis started via systemd ($REDIS_SVC)"
    else
        log_warn "Systemd failed, starting Redis manually..."
        sudo redis-server --daemonize yes || log_warn "Redis may already be running"
    fi
else
    log_warn "No systemd, starting Redis manually..."
    sudo redis-server --daemonize yes || log_warn "Redis may already be running"
fi

# ============================================
# 7. PROJECT SETUP
# ============================================
log_info "Setting up project..."

# Check if we're in the project directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found! Please run this script from the project root directory."
    log_error "Example: cd /path/to/AgentiFi-dev && bash scripts/setup-aws-universal.sh"
    exit 1
fi

# Install dependencies
log_info "Installing project dependencies..."
if [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
    bun install --frozen-lockfile || bun install
else
    bun install
fi

# ============================================
# 8. ENVIRONMENT CONFIGURATION
# ============================================
log_info "Configuring environment..."

# Detect AWS Public IP
AWS_IP=""
if curl --connect-timeout 2 -s http://169.254.169.254/latest/meta-data/public-ipv4 > /tmp/aws_ip.txt 2>/dev/null; then
    AWS_IP=$(cat /tmp/aws_ip.txt)
    rm -f /tmp/aws_ip.txt
    log_info "Detected AWS Public IP: $AWS_IP"
    DEFAULT_URL="https://$AWS_IP:3000"
else
    log_warn "Could not detect AWS IP, using placeholder"
    DEFAULT_URL="https://YOUR_SERVER_IP:3000"
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    log_info "Creating .env file..."
    
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        cat > .env << EOF
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[SUPABASE_HOST]:5432/postgres

# Redis
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3000
NODE_ENV=production

# Webhook Configuration
WEBAPP_URL=$DEFAULT_URL
WEBHOOK_URL=$DEFAULT_URL
WEBHOOK_SECRET=$(openssl rand -hex 16)

# Encryption
ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF
    fi
    
    # Ensure critical env vars are set
    grep -q "WEBAPP_URL=" .env || echo "WEBAPP_URL=$DEFAULT_URL" >> .env
    grep -q "WEBHOOK_URL=" .env || echo "WEBHOOK_URL=$DEFAULT_URL" >> .env
    grep -q "WEBHOOK_SECRET=" .env || echo "WEBHOOK_SECRET=$(openssl rand -hex 16)" >> .env
    grep -q "ENCRYPTION_KEY=" .env || echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
    
    log_warn "Created .env file - YOU MUST EDIT IT!"
    log_warn "Required: TELEGRAM_BOT_TOKEN, DATABASE_URL"
else
    log_info ".env file already exists"
fi

# ============================================
# 9. PROCESS MANAGER SETUP
# ============================================
log_info "Configuring process manager..."

PROJECT_DIR=$(pwd)
BUN_PATH=$(which bun)
CURRENT_USER=$(whoami)

# Check if systemd is available and working
SYSTEMD_WORKS=false
if command -v systemctl &> /dev/null; then
    if sudo systemctl list-units --type=service &> /dev/null 2>&1; then
        SYSTEMD_WORKS=true
    fi
fi

if [ "$SYSTEMD_WORKS" = true ]; then
    log_info "Systemd detected, creating service..."
    
    SERVICE_FILE="/etc/systemd/system/agentifi.service"
    
    # Create service file with proper error handling
    sudo tee $SERVICE_FILE > /dev/null << EOF
[Unit]
Description=AgentiFi Trading Bot
After=network.target ${REDIS_SVC}.service
Wants=${REDIS_SVC}.service

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${PROJECT_DIR}
ExecStart=${BUN_PATH} src/index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
EnvironmentFile=${PROJECT_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF
    
    # Verify file was created
    if [ ! -f "$SERVICE_FILE" ]; then
        log_error "Failed to create service file at $SERVICE_FILE"
        exit 1
    fi
    
    log_info "Service file created at $SERVICE_FILE"
    
    # Reload and enable
    sudo systemctl daemon-reload
    sudo systemctl enable agentifi
    
    log_info "✅ Systemd service configured"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 SETUP COMPLETE (Systemd Mode)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env file:"
    echo "   nano .env"
    echo ""
    echo "2. Start the bot:"
    echo "   sudo systemctl start agentifi"
    echo ""
    echo "3. Check status:"
    echo "   sudo systemctl status agentifi"
    echo ""
    echo "4. View logs:"
    echo "   sudo journalctl -u agentifi -f"
    echo ""
    
else
    log_warn "Systemd not available, using PM2..."
    
    # Install PM2 if needed
    if ! command -v pm2 &> /dev/null; then
        log_info "Installing PM2..."
        sudo npm install -g pm2
    fi
    
    log_info "✅ PM2 configured"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 SETUP COMPLETE (PM2 Mode)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env file:"
    echo "   nano .env"
    echo ""
    echo "2. Start the bot:"
    echo "   pm2 start src/index.ts --name agentifi --interpreter $BUN_PATH"
    echo "   pm2 save"
    echo "   pm2 startup"
    echo ""
    echo "3. Manage the bot:"
    echo "   pm2 status"
    echo "   pm2 logs agentifi"
    echo "   pm2 restart agentifi"
    echo ""
fi
