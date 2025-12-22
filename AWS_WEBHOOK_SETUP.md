# AWS Webhook Setup Guide

## The Problem

Telegram requires **HTTPS** for webhooks. You cannot use:

- ❌ `http://YOUR_IP:3742` (not HTTPS)
- ❌ `https://YOUR_IP:3742` (no SSL certificate)

## Solutions

### Option 1: Use a Domain with SSL (Recommended)

**Requirements:**

- A domain name (e.g., `yourdomain.com`)
- SSL certificate (free with Let's Encrypt)

**Steps:**

1. **Point domain to your AWS IP:**

   ```bash
   # In your DNS provider, create an A record:
   bot.yourdomain.com → YOUR_AWS_IP
   ```

2. **Install Nginx and Certbot:**

   ```bash
   sudo apt update
   sudo apt install nginx certbot python3-certbot-nginx -y
   ```

3. **Configure Nginx reverse proxy:**

   ```bash
   sudo nano /etc/nginx/sites-available/agentifi
   ```

   Add:

   ```nginx
   server {
       listen 80;
       server_name bot.yourdomain.com;

       location / {
           proxy_pass http://localhost:3742;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Enable site and get SSL:**

   ```bash
   sudo ln -s /etc/nginx/sites-available/agentifi /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   sudo certbot --nginx -d bot.yourdomain.com
   ```

5. **Update .env:**

   ```bash
   nano .env
   ```

   Set:

   ```
   WEBHOOK_URL=https://bot.yourdomain.com
   ```

6. **Restart bot:**
   ```bash
   ./auto-start.sh
   # or
   sudo systemctl restart agentifi
   ```

### Option 2: Skip Webhook (Testing Only)

**For testing without webhook:**

1. **Leave WEBHOOK_URL empty in .env:**

   ```bash
   # .env
   WEBHOOK_URL=
   ```

2. **Start bot:**

   ```bash
   ./auto-start.sh
   ```

3. **Bot will start but won't receive updates**
   - You can still test API endpoints
   - Bot commands won't work
   - Use this only for API testing

### Option 3: Use ngrok on AWS (Temporary Testing)

**For quick testing only:**

1. **Install ngrok on AWS:**

   ```bash
   curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
   sudo apt update && sudo apt install ngrok
   ngrok config add-authtoken YOUR_NGROK_TOKEN
   ```

2. **Start ngrok:**

   ```bash
   ngrok http 3742 &
   ```

3. **Get URL and update .env:**

   ```bash
   curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*ngrok-free.app' | head -n 1
   # Copy the URL and add to .env
   ```

4. **Restart bot:**
   ```bash
   ./auto-start.sh
   ```

⚠️ **Note:** ngrok URLs change on restart. Not suitable for production!

## Recommended Setup

For production AWS deployment:

```
1. Get a domain ($10-15/year)
2. Point it to your AWS IP
3. Install Nginx + Let's Encrypt (free SSL)
4. Use reverse proxy
5. Set WEBHOOK_URL=https://yourdomain.com
```

This is the **proper** way to run a Telegram bot on AWS.

## Auto-Start Behavior

When you run `./auto-start.sh` on AWS:

- **If WEBHOOK_URL is empty or invalid:** Script will ask for your domain
- **If you press Enter:** Bot starts without webhook (no updates)
- **If you provide domain:** Bot starts with webhook configured

## Troubleshooting

### Error: "invalid webhook URL specified"

- ✅ Make sure URL starts with `https://`
- ✅ Make sure domain has valid SSL certificate
- ✅ Test: `curl https://yourdomain.com` should work

### Bot starts but doesn't respond

- ✅ Check webhook is set: Look for "🔗 Webhook set:" in logs
- ✅ Verify SSL: `curl https://yourdomain.com/webhook` should return 404 (not SSL error)
- ✅ Check firewall: Port 80 and 443 must be open

### Need help?

Check the logs:

```bash
sudo journalctl -u agentifi -f
```
