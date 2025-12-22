# AgentiFi Auto-Start Script

## 🚀 One Command to Rule Them All

The `auto-start.sh` script automatically handles everything:

```bash
./auto-start.sh
```

## What It Does

### 1. Environment Detection

- ✅ Detects if running on AWS EC2 or local machine
- ✅ Auto-discovers AWS public IP
- ✅ Configures appropriate webhook URL

### 2. Dependency Checks

- ✅ Verifies Bun installation
- ✅ Checks for ngrok (local only)
- ✅ Validates all required tools

### 3. Configuration Validation

- ✅ Loads and validates `.env` file
- ✅ Checks for required variables:
  - `TELEGRAM_BOT_TOKEN`
  - `DATABASE_URL`
  - `REDIS_URL` (optional)

### 4. Database Connection Test

- ✅ Tests PostgreSQL connection
- ✅ Validates credentials
- ✅ Reports connection status

### 5. Redis Connection Test

- ✅ Pings Redis server
- ✅ Verifies connectivity
- ✅ Shows status

### 6. Webhook Auto-Configuration

**On AWS:**

- Detects public IP
- Updates `.env` with `https://YOUR_IP:3742`
- Removes any ngrok URLs

**On Local:**

- Starts ngrok tunnel automatically
- Gets public URL
- Configures webhook
- Falls back to `.env` if ngrok unavailable

### 7. Process Management

- ✅ Kills any existing bot processes
- ✅ Prevents port conflicts
- ✅ Clean startup

### 8. Bot Startup

- ✅ Starts bot with all configurations
- ✅ Shows configuration summary
- ✅ Handles graceful shutdown (Ctrl+C)

## Usage

### Local Development

```bash
cd /path/to/AgentiFi-dev
./auto-start.sh
```

### AWS/Production

```bash
cd /path/to/AgentiFi-dev
./auto-start.sh
```

### With Systemd (AWS)

Update the systemd service to use auto-start:

```bash
sudo nano /etc/systemd/system/agentifi.service
```

Change `ExecStart` to:

```ini
ExecStart=/path/to/AgentiFi-dev/auto-start.sh
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl restart agentifi
```

## Output Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 AgentiFi Auto-Start
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[→] Detecting environment...
[✓] Running on AWS EC2 (IP: 54.123.45.67)

[→] Checking dependencies...
[✓] Bun 1.2.12 installed

[→] Loading environment configuration...
[✓] Environment variables loaded

[→] Checking database connection...
[✓] PostgreSQL connection successful

[→] Checking Redis connection...
[✓] Redis connection successful

[→] Configuring webhook...
[✓] Webhook set to: https://54.123.45.67:3742

[→] Checking for existing processes...

[→] Starting AgentiFi Bot + API Server...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 Configuration Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment: AWS EC2
  Port: 3742
  Webhook: https://54.123.45.67:3742
  Database: db.supabase.co
  Redis: localhost:6379
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Starting AgentiFi Trading Bot...
```

## Troubleshooting

### Missing Dependencies

```
[✗] Bun not installed!
Install: curl -fsSL https://bun.sh/install | bash
```

→ Install the missing dependency

### Database Connection Failed

```
[!] PostgreSQL connection failed (will retry on startup)
```

→ Check `DATABASE_URL` in `.env`
→ Verify database is accessible

### No Webhook Configured

```
[!] No WEBHOOK_URL configured - bot will not receive updates
```

→ On AWS: Script will auto-configure
→ On Local: Install ngrok or set `WEBHOOK_URL` in `.env`

## Comparison with Other Scripts

| Script                | Use Case      | Webhook    | Auto-Config |
| --------------------- | ------------- | ---------- | ----------- |
| `auto-start.sh`       | **Universal** | ✅ Auto    | ✅ Yes      |
| `start-live.sh`       | Local dev     | ngrok only | ❌ No       |
| `start-production.sh` | AWS only      | .env only  | ❌ No       |
| `start-smart.sh`      | Local/AWS     | Semi-auto  | ⚠️ Partial  |

## Recommended Usage

- **Development:** Use `auto-start.sh` (handles everything)
- **Production:** Use `auto-start.sh` or systemd with `auto-start.sh`
- **Quick Test:** Use `auto-start.sh`

This is now the **recommended** way to start AgentiFi!
