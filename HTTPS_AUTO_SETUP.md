# Automated HTTPS Setup for AWS EC2

## 🚀 One-Command HTTPS Setup

This script automatically sets up HTTPS on your AWS EC2 Ubuntu instance.

### What It Does

1. ✅ Detects AWS EC2 and gets public IP
2. ✅ Reads port from `package.json` or `.env`
3. ✅ Installs Nginx (if not installed)
4. ✅ Installs Certbot (if not installed)
5. ✅ Configures Nginx reverse proxy
6. ✅ Obtains free SSL certificate from Let's Encrypt
7. ✅ Updates `.env` with HTTPS webhook URL
8. ✅ Sets up auto-renewal for SSL
9. ✅ Configures firewall
10. ✅ Tests HTTPS connection

### Prerequisites

**Before running the script:**

1. **Point your domain to AWS IP:**

   ```
   # In your DNS provider (Cloudflare, GoDaddy, etc.)
   Create A record:
   bot.yourdomain.com → YOUR_AWS_IP
   ```

2. **Open ports in AWS Security Group:**
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
   - Port 22 (SSH)

### Usage

**On your AWS EC2 Ubuntu instance:**

```bash
cd /path/to/AgentiFi-dev

# Run the setup script
sudo ./setup-https-auto.sh
```

### Interactive Prompts

The script will ask:

1. **Domain name:**

   ```
   Enter your domain (e.g., bot.yourdomain.com): bot.example.com
   ```

2. **Email for SSL:**
   ```
   Enter email for SSL certificate notifications: you@example.com
   ```

That's it! Everything else is automatic.

### Example Run

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔒 AgentiFi HTTPS Auto-Setup for AWS EC2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[→] Checking requirements...
[✓] AWS EC2 detected (IP: 54.123.45.67)
[✓] Using port: 3742

[→] Domain configuration...
Enter your domain (e.g., bot.yourdomain.com): bot.example.com
[✓] Domain: bot.example.com

[→] Verifying DNS configuration...
[✓] DNS correctly configured

[→] Installing Nginx...
[✓] Nginx installed

[→] Installing Certbot...
[✓] Certbot installed

[→] Configuring Nginx reverse proxy...
[✓] Nginx configuration valid
[✓] Nginx restarted

[→] Obtaining SSL certificate...
Enter email for SSL certificate notifications: you@example.com
[✓] SSL certificate obtained successfully

[→] Updating .env configuration...
[✓] .env updated with:
  WEBHOOK_URL=https://bot.example.com
  PORT=3742

[→] Setting up SSL auto-renewal...
[✓] SSL auto-renewal enabled

[→] Checking firewall...
[✓] Firewall configured (80, 443, 22)

[→] Testing HTTPS configuration...
[✓] HTTPS is working!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ HTTPS Setup Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configuration:
  🌐 Domain: bot.example.com
  🔒 SSL: Enabled (Let's Encrypt)
  📡 Port: 3742
  🔗 Webhook: https://bot.example.com

Next steps:
1. Start the bot:
   ./auto-start.sh
```

### After Setup

**Start the bot:**

```bash
./auto-start.sh
```

The bot will automatically use the HTTPS webhook URL!

**Or with systemd:**

```bash
sudo systemctl restart agentifi
sudo journalctl -u agentifi -f
```

### What Gets Configured

**Nginx Configuration:**

- Reverse proxy from `https://yourdomain.com` → `http://localhost:3742`
- SSL termination
- Proper headers for WebSocket support
- Request size limits

**SSL Certificate:**

- Free from Let's Encrypt
- Auto-renews every 60 days
- Managed by Certbot

**.env Updates:**

```bash
WEBHOOK_URL=https://yourdomain.com
PORT=3742
```

### Troubleshooting

**DNS not resolving:**

```bash
# Check DNS
dig +short bot.yourdomain.com

# Should return your AWS IP
```

**SSL certificate failed:**

```bash
# Common issues:
1. Domain not pointing to server
2. Ports 80/443 not open in AWS Security Group
3. Firewall blocking connections

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Check Certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

**Bot not responding:**

```bash
# Check if bot is running
sudo systemctl status agentifi

# Check bot logs
sudo journalctl -u agentifi -f

# Test webhook
curl https://yourdomain.com/health
```

### Complete Workflow

**Full setup from scratch:**

```bash
# 1. SSH into AWS
ssh ubuntu@YOUR_AWS_IP

# 2. Clone/navigate to project
cd AgentiFi-dev

# 3. Setup HTTPS (one time)
sudo ./setup-https-auto.sh
# Enter domain and email when prompted

# 4. Start bot
./auto-start.sh

# Done! Bot is running with HTTPS webhook
```

### SSL Certificate Renewal

The certificate auto-renews. To test renewal:

```bash
# Dry run
sudo certbot renew --dry-run

# Force renewal (if needed)
sudo certbot renew --force-renewal
```

### Removing HTTPS Setup

If you need to remove:

```bash
# Remove Nginx config
sudo rm /etc/nginx/sites-enabled/agentifi
sudo rm /etc/nginx/sites-available/agentifi
sudo systemctl restart nginx

# Revoke SSL certificate
sudo certbot revoke --cert-name yourdomain.com
sudo certbot delete --cert-name yourdomain.com
```

## Comparison with Manual Setup

| Task               | Manual              | Auto Script    |
| ------------------ | ------------------- | -------------- |
| Install Nginx      | 5 commands          | ✅ Automatic   |
| Configure Nginx    | Edit config file    | ✅ Automatic   |
| Install Certbot    | 3 commands          | ✅ Automatic   |
| Get SSL            | 1 command + prompts | ✅ Automatic   |
| Update .env        | Manual editing      | ✅ Automatic   |
| Setup renewal      | Manual              | ✅ Automatic   |
| Configure firewall | Manual              | ✅ Automatic   |
| **Total Time**     | ~30 minutes         | **~5 minutes** |

This is now the **recommended** way to set up HTTPS on AWS!
