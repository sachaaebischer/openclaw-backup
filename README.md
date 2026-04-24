# OpenClaw Backup — Recovery Guide

**Repository:** https://github.com/sachaaebischer/openclaw-backup  
**Backup frequency:** Weekly (Sunday 03:00) + manual runs  
**Last backup:** See git log

---

## What's In This Backup

### ✅ Backed Up Automatically

| Folder | Contents | Recovery |
|--------|----------|----------|
| `openclaw_config/` | `openclaw.json` — full config (API keys redacted) | Restore manually from `SECRETS.txt` |
| `agent_workspaces/` | All agent workspace files | Copy to `~/.openclaw/agents/<agent>/workspace/` |
| `gym_logger/` | Gym logger source + logs | Copy to `~/Projects/gym-logger/` |
| `scripts/` | Backup script | Run manually or set up cron |

### ⚠️ API Keys and Tokens — NOT in this repo
See `SECRETS.txt` — **keep this file somewhere safe** (password manager). It contains:
- Model API keys (Anthropic, Minimax)
- MCP tokens (Ultrahuman, Garmin, Polar)
- Telegram bot tokens

---

## Recovery Procedure (Full VM Rebuild)

### 1. Collect Secrets
Get `SECRETS.txt` from your password manager. You'll need:
- Minimax API key
- Anthropic API key
- Ultrahuman token + email
- Garmin email + password
- Polar access token + user ID
- Telegram bot tokens (2x)

### 2. Fresh VM Setup
```bash
# Install OpenClaw
npm install -g openclaw

# Install gym logger dependencies
mkdir -p ~/Projects/gym-logger
cd ~/Projects/gym-logger
# Copy files from backup/gym_logger/ first, then:
npm install
```

### 3. Restore Config
```bash
# Clone this repo
git clone https://github.com/sachaaebischer/openclaw-backup.git ~/openclaw-backup

# Restore OpenClaw config (fill in API keys first)
cp ~/openclaw-backup/openclaw_config/openclaw.json ~/.openclaw/
# Edit openclaw.json and replace <REDACTED_*> with actual values from SECRETS.txt

# Restore agent workspaces
cp -r ~/openclaw-backup/agent_workspaces/* ~/.openclaw/agents/

# Restore gym logger logs
cp -r ~/openclaw-backup/gym_logger/logs ~/Projects/gym-logger/
```

### 4. Rebuild Polar MCP (if needed)
```bash
cd /tmp
git clone https://github.com/NelsonNew/polar-mcp-server.git
cd polar-mcp-server
npm install
npm run build
```

### 5. Start Services
```bash
# Start OpenClaw gateway
openclaw gateway start

# Start gym logger
cd ~/Projects/gym-logger && TZ=Europe/Zurich node server.js &
```

### 6. Verify
```bash
openclaw mcp list
# Should show: ultrahuman, garmin, polar
```

---

## Weekly Cron Setup

Add to crontab (`crontab -e`):
```
0 3 * * 0 /path/to/backup.sh >> /tmp/backup.log 2>&1
```

Or run manually:
```bash
./scripts/backup.sh
```

---

## Server Info (Current)

| Item | Value |
|------|-------|
| VM Tailscale IP | `100.72.171.107` |
| Gym logger URL | `http://100.72.171.107:3000` |
| OpenClaw version | `2026.4.21` |
| Node version | `v22.22.0` |
| OS | Ubuntu 24.04 |
| Timezone | Europe/Zurich (CEST) |

---

_Last updated: 2026-04-24_
