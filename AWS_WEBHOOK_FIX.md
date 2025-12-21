# AWS Deployment Quick Fix

## Problem

Bot on AWS is showing ngrok URL instead of AWS public IP.

## Solution

**On your AWS server, run:**

```bash
# 1. Navigate to project directory
cd /path/to/AgentiFi-dev

# 2. Run the fix script
./scripts/fix-aws-webhook.sh

# 3. Restart the bot
sudo systemctl restart agentifi

# 4. Verify
sudo journalctl -u agentifi -f
```

The script will:

- ✅ Auto-detect your AWS public IP
- ✅ Update `.env` with correct `WEBHOOK_URL`
- ✅ Backup your old `.env`
- ✅ Show you the restart command

## Manual Fix (Alternative)

If you prefer to do it manually:

```bash
# 1. Get your AWS public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4

# 2. Edit .env
nano .env

# 3. Update this line:
WEBHOOK_URL=https://YOUR_AWS_IP:3742

# 4. Restart
sudo systemctl restart agentifi
```

## Important Notes

- ⚠️ Make sure your AWS Security Group allows inbound traffic on port 3742
- ⚠️ If using HTTPS, ensure you have SSL certificates configured
- ⚠️ For HTTP, use: `WEBHOOK_URL=http://YOUR_AWS_IP:3742`

## Verify It's Working

After restart, check logs:

```bash
sudo journalctl -u agentifi -f
```

You should see:

```
🔗 Webhook set: https://YOUR_AWS_IP:3742/webhook
```

NOT:

```
🔗 Webhook set: https://xxx.ngrok-free.app/webhook
```
