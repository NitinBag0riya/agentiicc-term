#!/bin/bash

# auto-start.sh
# Fully automated startup script for AgentiFi
# Handles: Environment detection, webhook setup, DB checks, bot startup

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "${BLUE}[→]${NC} $1"; }

# Banner
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 AgentiFi Auto-Start"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================
# 1. ENVIRONMENT DETECTION
# ============================================
log_step "Detecting environment..."

# Check if running on AWS
IS_AWS=false
AWS_IP=""
if curl --connect-timeout 2 -s http://169.254.169.254/latest/meta-data/public-ipv4 > /tmp/aws_ip.txt 2>/dev/null; then
    AWS_IP=$(cat /tmp/aws_ip.txt)
    rm -f /tmp/aws_ip.txt
    IS_AWS=true
    log_info "Running on AWS EC2 (IP: $AWS_IP)"
else
    log_info "Running on local machine"
fi

# ============================================
# 2. CHECK DEPENDENCIES
# ============================================
log_step "Checking dependencies..."

# Check Bun
if ! command -v bun &> /dev/null; then
    if [ -f "$HOME/.bun/bin/bun" ]; then
        export PATH="$HOME/.bun/bin:$PATH"
        log_info "Bun found at ~/.bun/bin"
    else
        log_error "Bun not installed!"
        echo "Install: curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
else
    log_info "Bun $(bun -v) installed"
fi

# Check ngrok (install if not found on Ubuntu)
NGROK_AVAILABLE=false
if command -v ngrok &> /dev/null; then
    NGROK_AVAILABLE=true
    log_info "ngrok available"
elif [ -f "/opt/homebrew/bin/ngrok" ]; then
    export PATH="/opt/homebrew/bin:$PATH"
    NGROK_AVAILABLE=true
    log_info "ngrok found at /opt/homebrew/bin"
elif [ -f "/usr/local/bin/ngrok" ]; then
    export PATH="/usr/local/bin:$PATH"
    NGROK_AVAILABLE=true
    log_info "ngrok found at /usr/local/bin"
else
    # Try to install ngrok on Ubuntu
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [[ "$ID" == "ubuntu" ]] || [[ "$ID_LIKE" == *"ubuntu"* ]] || [[ "$ID" == "debian" ]] || [[ "$ID_LIKE" == *"debian"* ]]; then
            log_warn "ngrok not found - installing for Ubuntu x64..."
            
            # Install ngrok
            if curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null 2>&1 && \
               echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list >/dev/null 2>&1 && \
               sudo apt update -qq 2>&1 && \
               sudo apt install -y ngrok 2>&1; then
                log_info "ngrok installed successfully"
                NGROK_AVAILABLE=true
                
                # Prompt for auth token
                echo ""
                echo "ngrok requires an auth token from https://dashboard.ngrok.com/get-started/your-authtoken"
                read -p "Enter your ngrok auth token (or press Enter to skip): " NGROK_TOKEN
                if [ ! -z "$NGROK_TOKEN" ]; then
                    ngrok config add-authtoken "$NGROK_TOKEN" 2>&1
                    log_info "ngrok auth token configured"
                else
                    log_warn "Skipped ngrok auth token - you'll need to set it later"
                    log_warn "Run: ngrok config add-authtoken YOUR_TOKEN"
                fi
            else
                log_warn "Failed to install ngrok automatically"
                NGROK_AVAILABLE=false
            fi
        else
            log_warn "ngrok not found - will use .env WEBHOOK_URL if available"
        fi
    else
        log_warn "ngrok not found - will use .env WEBHOOK_URL if available"
    fi
fi

# ============================================
# 3. LOAD AND VALIDATE .ENV
# ============================================
log_step "Loading environment configuration..."

if [ ! -f .env ]; then
    log_error ".env file not found!"
    echo "Create .env with required variables:"
    echo "  TELEGRAM_BOT_TOKEN=your_token"
    echo "  DATABASE_URL=postgresql://..."
    exit 1
fi

# Load .env
export $(grep -v '^#' .env | xargs 2>/dev/null)

# Validate critical variables
MISSING_VARS=()
[ -z "$TELEGRAM_BOT_TOKEN" ] && MISSING_VARS+=("TELEGRAM_BOT_TOKEN")
[ -z "$DATABASE_URL" ] && MISSING_VARS+=("DATABASE_URL")

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    log_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

log_info "Environment variables loaded"

# ============================================
# 4. DATABASE CONNECTION CHECK
# ============================================
log_step "Checking database connection..."

# Extract DB details from DATABASE_URL
if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
    
    # Try to connect
    if command -v psql &> /dev/null; then
        if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &> /dev/null; then
            log_info "PostgreSQL connection successful"
        else
            log_warn "PostgreSQL connection failed (will retry on startup)"
        fi
    else
        log_info "PostgreSQL client not installed (skipping connection test)"
    fi
else
    log_warn "Could not parse DATABASE_URL"
fi

# ============================================
# 5. REDIS CONNECTION CHECK
# ============================================
log_step "Checking Redis connection..."

REDIS_HOST="localhost"
REDIS_PORT="6379"

if [ ! -z "$REDIS_URL" ]; then
    if [[ $REDIS_URL =~ redis://([^:]+):([0-9]+) ]]; then
        REDIS_HOST="${BASH_REMATCH[1]}"
        REDIS_PORT="${BASH_REMATCH[2]}"
    fi
fi

if command -v redis-cli &> /dev/null; then
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &> /dev/null; then
        log_info "Redis connection successful"
    else
        log_warn "Redis not responding (will retry on startup)"
    fi
else
    log_info "Redis client not installed (skipping connection test)"
fi

# ============================================
# 6. WEBHOOK CONFIGURATION
# ============================================
log_step "Configuring webhook..."

WEBHOOK_URL_CONFIGURED=false

if [ "$IS_AWS" = true ]; then
    # AWS: Need domain with SSL or skip webhook
    if [ -z "$WEBHOOK_URL" ] || [[ "$WEBHOOK_URL" == *"ngrok"* ]] || [[ "$WEBHOOK_URL" == *"$AWS_IP"* ]]; then
        log_warn "Webhook configuration needed for AWS"
        echo ""
        echo "Telegram requires HTTPS for webhooks. You have 3 options:"
        echo ""
        echo "1. Use a domain with SSL (recommended)"
        echo "   Example: https://yourdomain.com"
        echo ""
        echo "2. Skip webhook (bot won't receive updates)"
        echo "   You can set it up later"
        echo ""
        echo "3. Use ngrok on AWS (temporary testing only)"
        echo ""
        
        # Check if running interactively
        if [ -t 0 ]; then
            read -p "Enter your domain with HTTPS (or press Enter to skip): " USER_DOMAIN
            
            if [ ! -z "$USER_DOMAIN" ]; then
                # Validate it starts with https://
                if [[ "$USER_DOMAIN" == https://* ]]; then
                    NEW_WEBHOOK="$USER_DOMAIN"
                else
                    NEW_WEBHOOK="https://$USER_DOMAIN"
                fi
                
                # Backup .env
                cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
                
                # Update .env - escape special characters for sed
                ESCAPED_WEBHOOK=$(echo "$NEW_WEBHOOK" | sed 's/[\/&]/\\&/g')
                
                if grep -q "^WEBHOOK_URL=" .env; then
                    sed -i.bak "s|^WEBHOOK_URL=.*|WEBHOOK_URL=$ESCAPED_WEBHOOK|" .env
                else
                    echo "WEBHOOK_URL=$NEW_WEBHOOK" >> .env
                fi
                rm -f .env.bak
                
                export WEBHOOK_URL="$NEW_WEBHOOK"
                log_info "Webhook set to: $WEBHOOK_URL"
                WEBHOOK_URL_CONFIGURED=true
            else
                log_warn "Skipping webhook configuration"
                log_warn "Bot will start but won't receive Telegram updates"
                export WEBHOOK_URL=""
                WEBHOOK_URL_CONFIGURED=false
            fi
        else
            # Non-interactive (systemd) - check if valid webhook exists
            if [ ! -z "$WEBHOOK_URL" ] && [[ "$WEBHOOK_URL" == https://* ]]; then
                log_info "Using configured webhook: $WEBHOOK_URL"
                WEBHOOK_URL_CONFIGURED=true
            else
                log_warn "No valid HTTPS webhook configured"
                log_warn "Bot will start but won't receive updates"
                export WEBHOOK_URL=""
                WEBHOOK_URL_CONFIGURED=false
            fi
        fi
    else
        log_info "Using configured webhook: $WEBHOOK_URL"
        WEBHOOK_URL_CONFIGURED=true
    fi
    
else
    # Local: Try ngrok
    if [ "$NGROK_AVAILABLE" = true ]; then
        log_info "Starting ngrok tunnel..."
        
        PORT=${PORT:-3742}
        
        # Kill existing ngrok
        pkill ngrok 2>/dev/null || true
        sleep 1
        
        # Start ngrok in background
        ngrok http $PORT > /tmp/ngrok.log 2>&1 &
        NGROK_PID=$!
        
        # Wait for ngrok to start
        sleep 3
        
        # Get ngrok URL
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*ngrok-free.app' | head -n 1)
        
        if [ ! -z "$NGROK_URL" ]; then
            export WEBHOOK_URL="$NGROK_URL"
            log_info "ngrok tunnel active: $WEBHOOK_URL"
            
            # Auto-update .env with latest ngrok URL
            log_info "Updating .env with latest ngrok URL..."
            
            # Backup .env
            cp .env .env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
            
            # Escape special characters for sed
            ESCAPED_WEBHOOK=$(echo "$NGROK_URL" | sed 's/[\/&]/\\&/g')
            
            # Update or add WEBHOOK_URL
            if grep -q "^WEBHOOK_URL=" .env 2>/dev/null; then
                sed -i.bak "s|^WEBHOOK_URL=.*|WEBHOOK_URL=$ESCAPED_WEBHOOK|" .env
            else
                echo "WEBHOOK_URL=$NGROK_URL" >> .env
            fi
            rm -f .env.bak
            
            log_info ".env updated with WEBHOOK_URL=$NGROK_URL"
            WEBHOOK_URL_CONFIGURED=true
        else
            log_warn "Failed to get ngrok URL"
            pkill ngrok 2>/dev/null || true
        fi
    fi
    
    # Fallback to .env
    if [ "$WEBHOOK_URL_CONFIGURED" = false ]; then
        if [ ! -z "$WEBHOOK_URL" ]; then
            log_info "Using .env WEBHOOK_URL: $WEBHOOK_URL"
            WEBHOOK_URL_CONFIGURED=true
        else
            log_warn "No WEBHOOK_URL configured - bot will not receive updates"
        fi
    fi
fi

# ============================================
# 7. KILL EXISTING PROCESSES
# ============================================
log_step "Checking for existing processes..."

if pgrep -f "bun.*index.ts" > /dev/null; then
    log_warn "Stopping existing bot process..."
    pkill -f "bun.*index.ts" || true
    sleep 2
fi

# ============================================
# 8. START THE BOT
# ============================================
log_step "Starting AgentiFi Bot + API Server..."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 Configuration Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Environment: $([ "$IS_AWS" = true ] && echo "AWS EC2" || echo "Local")"
echo "  Port: ${PORT:-3742}"
echo "  Webhook: ${WEBHOOK_URL:-'Not configured'}"
echo "  Database: ${DB_HOST:-'Unknown'}"
echo "  Redis: ${REDIS_HOST}:${REDIS_PORT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cleanup function
cleanup() {
    echo ""
    log_warn "Shutting down..."
    pkill -f "bun.*index.ts" 2>/dev/null || true
    if [ "$IS_AWS" = false ]; then
        pkill ngrok 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start the bot
exec bun src/index.ts
