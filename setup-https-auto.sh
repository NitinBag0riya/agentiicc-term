#!/bin/bash

# setup-https-auto.sh
# Fully automated HTTPS setup for Ubuntu EC2
# Sets up Nginx, SSL, and configures webhook automatically

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "${BLUE}[→]${NC} $1"; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔒 AgentiFi HTTPS Auto-Setup for AWS EC2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================
# 1. CHECK REQUIREMENTS
# ============================================
log_step "Checking requirements..."

# Must be root or sudo
if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    log_error "This script requires sudo privileges"
    exit 1
fi

# Must be on AWS
AWS_IP=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
if [ -z "$AWS_IP" ]; then
    log_error "Not running on AWS EC2!"
    exit 1
fi
log_info "AWS EC2 detected (IP: $AWS_IP)"

# Must have .env
if [ ! -f .env ]; then
    log_error ".env file not found!"
    exit 1
fi

# Load .env
export $(grep -v '^#' .env | xargs 2>/dev/null)

# Get port from package.json or .env
if [ -f package.json ]; then
    # Try to extract port from package.json scripts
    PORT_FROM_PKG=$(grep -o '"PORT"[[:space:]]*:[[:space:]]*[0-9]*' package.json | grep -o '[0-9]*' || echo "")
    if [ ! -z "$PORT_FROM_PKG" ]; then
        PORT=${PORT:-$PORT_FROM_PKG}
    fi
fi
PORT=${PORT:-3742}
log_info "Using port: $PORT"

# ============================================
# 2. GET DOMAIN FROM USER
# ============================================
log_step "Domain configuration..."

echo ""
echo "You need a domain pointing to this server ($AWS_IP)"
echo ""
echo "Examples:"
echo "  - bot.yourdomain.com"
echo "  - api.yourdomain.com"
echo "  - agentifi.yourdomain.com"
echo ""

# Check if domain already configured
EXISTING_DOMAIN=""
if [ ! -z "$WEBHOOK_URL" ] && [[ "$WEBHOOK_URL" == https://* ]] && [[ "$WEBHOOK_URL" != *"ngrok"* ]]; then
    EXISTING_DOMAIN=$(echo "$WEBHOOK_URL" | sed 's|https://||' | sed 's|/.*||')
    echo "Found existing domain in .env: $EXISTING_DOMAIN"
    read -p "Use this domain? (y/n, default: y): " USE_EXISTING
    USE_EXISTING=${USE_EXISTING:-y}
    
    if [[ "$USE_EXISTING" =~ ^[Yy]$ ]]; then
        DOMAIN="$EXISTING_DOMAIN"
    fi
fi

if [ -z "$DOMAIN" ]; then
    read -p "Enter your domain (e.g., bot.yourdomain.com): " DOMAIN
    
    if [ -z "$DOMAIN" ]; then
        log_error "Domain is required!"
        exit 1
    fi
fi

log_info "Domain: $DOMAIN"

# ============================================
# 3. VERIFY DNS
# ============================================
log_step "Verifying DNS configuration..."

DOMAIN_IP=$(dig +short "$DOMAIN" | tail -n1)
if [ -z "$DOMAIN_IP" ]; then
    log_warn "Could not resolve $DOMAIN"
    echo ""
    echo "Please make sure you have created an A record:"
    echo "  $DOMAIN → $AWS_IP"
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        exit 1
    fi
elif [ "$DOMAIN_IP" != "$AWS_IP" ]; then
    log_warn "Domain points to $DOMAIN_IP but server is $AWS_IP"
    echo ""
    echo "Please update your DNS A record:"
    echo "  $DOMAIN → $AWS_IP"
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    log_info "DNS correctly configured"
fi

# ============================================
# 4. INSTALL NGINX
# ============================================
log_step "Installing Nginx..."

if command -v nginx &> /dev/null; then
    log_info "Nginx already installed"
else
    sudo apt update -qq
    sudo apt install -y nginx
    log_info "Nginx installed"
fi

# ============================================
# 5. INSTALL CERTBOT
# ============================================
log_step "Installing Certbot..."

if command -v certbot &> /dev/null; then
    log_info "Certbot already installed"
else
    sudo apt install -y certbot python3-certbot-nginx
    log_info "Certbot installed"
fi

# ============================================
# 6. CONFIGURE NGINX
# ============================================
log_step "Configuring Nginx reverse proxy..."

NGINX_CONF="/etc/nginx/sites-available/agentifi"

sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Allow large request bodies for file uploads
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Enable site
sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/agentifi

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
if sudo nginx -t 2>&1 | grep -q "successful"; then
    log_info "Nginx configuration valid"
else
    log_error "Nginx configuration failed!"
    sudo nginx -t
    exit 1
fi

# Restart Nginx
sudo systemctl restart nginx
log_info "Nginx restarted"

# ============================================
# 7. GET SSL CERTIFICATE
# ============================================
log_step "Obtaining SSL certificate..."

# Check if certificate already exists
if sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    log_info "SSL certificate already exists for $DOMAIN"
else
    # Get email for Let's Encrypt
    read -p "Enter email for SSL certificate notifications: " SSL_EMAIL
    
    if [ -z "$SSL_EMAIL" ]; then
        log_error "Email is required for SSL certificate!"
        exit 1
    fi
    
    # Obtain certificate
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" --redirect
    
    if [ $? -eq 0 ]; then
        log_info "SSL certificate obtained successfully"
    else
        log_error "Failed to obtain SSL certificate!"
        echo ""
        echo "Common issues:"
        echo "  1. Domain not pointing to this server"
        echo "  2. Port 80/443 not open in security group"
        echo "  3. Firewall blocking connections"
        exit 1
    fi
fi

# ============================================
# 8. UPDATE .ENV
# ============================================
log_step "Updating .env configuration..."

WEBHOOK_URL="https://$DOMAIN"

# Backup .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update WEBHOOK_URL
if grep -q "^WEBHOOK_URL=" .env; then
    sed -i.bak "s|^WEBHOOK_URL=.*|WEBHOOK_URL=$WEBHOOK_URL|" .env
else
    echo "WEBHOOK_URL=$WEBHOOK_URL" >> .env
fi

# Update WEBAPP_URL if exists
if grep -q "^WEBAPP_URL=" .env; then
    sed -i.bak "s|^WEBAPP_URL=.*|WEBAPP_URL=$WEBHOOK_URL|" .env
fi

# Update PORT if needed
if grep -q "^PORT=" .env; then
    sed -i.bak "s|^PORT=.*|PORT=$PORT|" .env
else
    echo "PORT=$PORT" >> .env
fi

rm -f .env.bak

log_info ".env updated with:"
echo "  WEBHOOK_URL=$WEBHOOK_URL"
echo "  PORT=$PORT"

# ============================================
# 9. SETUP AUTO-RENEWAL
# ============================================
log_step "Setting up SSL auto-renewal..."

# Certbot automatically sets up renewal, just verify
if sudo systemctl is-enabled certbot.timer &> /dev/null; then
    log_info "SSL auto-renewal already configured"
else
    sudo systemctl enable certbot.timer
    sudo systemctl start certbot.timer
    log_info "SSL auto-renewal enabled"
fi

# ============================================
# 10. CONFIGURE FIREWALL
# ============================================
log_step "Checking firewall..."

if command -v ufw &> /dev/null; then
    # Enable UFW if not already
    if sudo ufw status | grep -q "Status: active"; then
        log_info "UFW firewall active"
    else
        log_warn "UFW not active, enabling..."
        sudo ufw --force enable
    fi
    
    # Allow necessary ports
    sudo ufw allow 80/tcp > /dev/null 2>&1
    sudo ufw allow 443/tcp > /dev/null 2>&1
    sudo ufw allow 22/tcp > /dev/null 2>&1
    
    log_info "Firewall configured (80, 443, 22)"
else
    log_warn "UFW not installed - make sure AWS Security Group allows ports 80, 443"
fi

# ============================================
# 11. TEST HTTPS
# ============================================
log_step "Testing HTTPS configuration..."

sleep 2

if curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" | grep -q "200\|404\|502"; then
    log_info "HTTPS is working!"
else
    log_warn "HTTPS test failed - but this might be because the app isn't running yet"
fi

# ============================================
# 12. SUMMARY
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ HTTPS Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  🌐 Domain: $DOMAIN"
echo "  🔒 SSL: Enabled (Let's Encrypt)"
echo "  📡 Port: $PORT"
echo "  🔗 Webhook: $WEBHOOK_URL"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the bot:"
echo "   ./auto-start.sh"
echo "   # or"
echo "   sudo systemctl restart agentifi"
echo ""
echo "2. Check logs:"
echo "   sudo journalctl -u agentifi -f"
echo ""
echo "3. Verify webhook:"
echo "   curl https://$DOMAIN/health"
echo ""
echo "SSL certificate will auto-renew every 60 days."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
