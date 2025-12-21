#!/bin/bash
set -e

# AgentiFi AWS Amazon Linux Setup Script
# Compatible with Amazon Linux 2 and Amazon Linux 2023.
# Replaces apt with yum/dnf.

echo "🚀 Starting AgentiFi AWS Setup (Amazon Linux)..."
echo "------------------------------------------------"

# Auto-Detect Package Manager
if command -v dnf &> /dev/null; then
    PKG_MAN="dnf"
    echo "🔍 Detected Package Manager: dnf (Amazon Linux 2023 / Fedora)"
elif command -v yum &> /dev/null; then
    PKG_MAN="yum"
    echo "🔍 Detected Package Manager: yum (Amazon Linux 2 / CentOS)"
elif command -v apt-get &> /dev/null; then
    PKG_MAN="apt-get"
    echo "🔍 Detected Package Manager: apt-get (Debian / Ubuntu)"
elif command -v apk &> /dev/null; then
    PKG_MAN="apk"
    echo "🔍 Detected Package Manager: apk (Alpine)"
else
    echo "❌ No supported package manager found (dnf, yum, apt-get, apk)."
    exit 1
fi

# 1. System Updates & Essentials
echo "📦 Updating system packages..."

if [ "$PKG_MAN" == "apt-get" ]; then
    sudo $PKG_MAN update -y && sudo $PKG_MAN upgrade -y
    sudo $PKG_MAN install -y git unzip jq build-essential
elif [ "$PKG_MAN" == "apk" ]; then
    sudo $PKG_MAN update
    sudo $PKG_MAN add git unzip jq build-base
else
    # dnf / yum
    sudo $PKG_MAN update -y
    sudo $PKG_MAN install -y git unzip jq util-linux-user
    sudo $PKG_MAN groupinstall -y "Development Tools"
fi

# 2. Install Node.js (LTS)
if ! command -v node &> /dev/null; then
    echo "🟢 Installing Node.js..."
    if [ "$PKG_MAN" == "dnf" ]; then
        sudo dnf install -y nodejs
    elif [ "$PKG_MAN" == "yum" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    elif [ "$PKG_MAN" == "apt-get" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
     echo "   Node $(node -v) installed."
else
    echo "✅ Node.js already installed: $(node -v)"
fi

# 3. Install Redis
echo "🗄️  Installing Redis..."

if [ "$PKG_MAN" == "apt-get" ]; then
    sudo apt-get install -y redis-server
elif [ "$PKG_MAN" == "apk" ]; then
    sudo apk add redis
else
    # dnf / yum
    # Amazon Linux via Extras or native
    if command -v amazon-linux-extras &> /dev/null; then
        sudo amazon-linux-extras install redis6 -y
    else
        sudo $PKG_MAN install -y redis6 || sudo $PKG_MAN install -y redis
    fi
fi

# Start Redis (Systemd or Manual Fallback)
echo "⚙️  Starting Redis..."

# Detect Service Name (redis-server for Debian/Ubuntu, redis for RHEL/AL2)
if systemctl list-units --all --type=service | grep -q "redis-server.service"; then
    REDIS_SVC="redis-server"
else
    REDIS_SVC="redis"
fi

if sudo systemctl start $REDIS_SVC 2>/dev/null; then
    sudo systemctl enable $REDIS_SVC
    echo "✅ Redis started via Systemd ($REDIS_SVC)."
else
    echo "⚠️  Systemd not available. Starting Redis manually..."
    sudo redis-server --daemonize yes || echo "Redis failed to daemonize (might be running)."
fi

# ... (Bun/Node checks remain same) ...

# 8. Setup Process Manager (Systemd or PM2)
echo "⚙️  Configuring Process Manager..."

SYSTEMD_WORKS=false
if command -v systemctl &> /dev/null; then
    if sudo systemctl list-units --type=service &> /dev/null; then
        SYSTEMD_WORKS=true
    fi
fi

if [ "$SYSTEMD_WORKS" = true ]; then
    echo "✅ Systemd detected. Configuring service..."
    SERVICE_NAME="agentifi"
    SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
    CURRENT_USER=$(whoami)
    PROJECT_DIR=$(pwd)
    BUN_PATH=$(which bun)

    sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=AgentiFi Trading Bot
After=network.target redis.service

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
    🎉 SETUP COMPLETE (Systemd)!
    Start app: sudo systemctl start agentifi
    "
else
    echo "⚠️  Systemd not available/working. Switching to PM2..."
    
    # Install PM2
    if ! command -v pm2 &> /dev/null; then
        echo "📦 Installing PM2..."
        sudo npm install -g pm2
    fi
    
    # Start App
    echo "🚀 Starting App with PM2..."
    export BUN_PATH=$(which bun)
    pm2 start src/index.ts --name agentifi --interpreter $BUN_PATH
    pm2 save
    
    echo "
    🎉 SETUP COMPLETE (PM2)!
    
    App is running in background.
    Manage it with:
    - pm2 status
    - pm2 logs agentifi
    - pm2 stop agentifi
    "
fi

