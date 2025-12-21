# AgentiFi Startup Scripts Guide

## Local Development (with ngrok)

Use this when developing locally and need a public URL:

```bash
./scripts/start-live.sh
```

- ✅ Automatically starts ngrok tunnel
- ✅ Sets WEBHOOK_URL to ngrok URL
- ✅ Hot reload enabled

## Production/AWS (NO ngrok)

Use this on AWS EC2, cloud servers, or any production environment:

```bash
./scripts/start-production.sh
```

- ✅ Uses WEBHOOK_URL from .env (your public domain/IP)
- ✅ No ngrok dependency
- ✅ Production mode

### Production .env Setup

```bash
# Your public domain or IP
WEBHOOK_URL=https://yourdomain.com
# OR
WEBHOOK_URL=https://YOUR_AWS_IP:3742

# Other required vars
TELEGRAM_BOT_TOKEN=your_token
DATABASE_URL=postgresql://...
PORT=3742
```

## Systemd Service (AWS)

After running `setup-aws-universal.sh`:

```bash
# Start
sudo systemctl start agentifi

# Stop
sudo systemctl stop agentifi

# Restart
sudo systemctl restart agentifi

# View logs
sudo journalctl -u agentifi -f
```

## Key Differences

| Feature     | start-live.sh   | start-production.sh |
| ----------- | --------------- | ------------------- |
| Environment | Local Dev       | AWS/Production      |
| Ngrok       | ✅ Required     | ❌ Not used         |
| Webhook     | Auto from ngrok | From .env           |
| Hot Reload  | ✅ Yes          | ❌ No               |
| Use Case    | Development     | Production          |
