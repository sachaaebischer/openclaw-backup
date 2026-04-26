# Recovery Guide — OpenClaw Health Setup

## What We Built

- **OpenClaw** main agent (me) + **Coach** fitness agent
- **3 MCP servers**: Ultrahuman, Garmin, Polar
- **Gym logger** web app at `http://100.72.171.107:3000`
- **Health data**: Ultrahuman ring, Garmin bike/watch, Polar H10

## If Something Breaks

### 1. Gym logger down
```bash
~/Projects/gym-logger/start.sh
```
Or manually:
```bash
cd ~/Projects/gym-logger && TZ=Europe/Zurich node server.js &
```

### 2. MCP servers not responding
MCP servers run as child processes of OpenClaw — they auto-restart. If stuck:
```bash
openclaw mcp list  # check status
# Restart OpenClaw gateway if needed:
openclaw gateway restart
```

### 3. OpenClaw config corrupted
The `openclaw.json` auto-backs up to `.bak` files. To restore:
```bash
cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json
openclaw gateway restart
```

### 4. Full VM reboot
Run:
```bash
~/Projects/gym-logger/start.sh
openclaw gateway start   # if gateway doesn't auto-start
```

### 5. Telegram bot token lost (Coach or main)
- Main bot: BotFather token for `@your_main_bot`
- Coach bot: token from BotFather for `@your_coach_bot`
- Re-add to `openclaw.json` under `channels.telegram.accounts`

## Credentials & Where to Find Them

### MCP Tokens (in `~/.openclaw/openclaw.json`)
| Service | Key |
|---------|-----|
| Ultrahuman | `ULTRAHUMAN_AUTH_TOKEN`, `ULTRAHUMAN_USER_EMAIL` |
| Garmin | `GARMIN_EMAIL`, `GARMIN_PASSWORD` |
| Polar | `POLAR_ACCESS_TOKEN`, `POLAR_USER_ID` |

### Telegram Bot Tokens
- Main: `8065384421:AAGS-QnHLbb8CgMSRqwNw7NhmYmYdp2aeS8`
- Coach: `8357659123:AAFm_WLG2XzfB6lSf_7BhQHurhQYh9Ep3Ik`

### Files to Back Up Manually
Everything important is in `~/Projects/gym-logger/backup/`:
- `openclaw.json` — full OpenClaw config with MCP credentials
- `agents/` — Coach agent personality files
- `credentials/` — Telegram pairing data

**Push backup to GitHub** (keep it private or use a secrets manager for production).

## Health Check

A cron job runs `health-check.sh` every 30 minutes:
- Checks gym logger is up
- Auto-restarts if down
- Sends Telegram alert if restart fails

## Preventing Breakage

1. **Don't run `openclaw update`** without testing first — updates can change behavior
2. **Polar token**: Access tokens don't expire. If re-auth needed, see Polar admin portal
3. **Garmin**: Password may need re-entry if Garmin detects unusual login
4. **Ultrahuman**: Token-based, very stable

## Emergency Contact

If everything is down and the above doesn't work:
1. Check `~/.openclaw/logs/` for errors
2. Run `openclaw status` 
3. Check `tail -f ~/.openclaw/logs/*.log`

### Withings MCP
- Clone: `git clone https://github.com/Schimmilab/withings-mcp-server.git /tmp/withings-mcp`
- Install: `python3.12 -m pip install -e /tmp/withings-mcp --break-system-packages`
- Tokens stored in: `/tmp/withings-mcp/.env` (also backed up to `~/Projects/gym-logger/backup/withings.env`)
- OpenClaw config: `openclaw mcp set withings {...}` (already configured)
- Devices: Body Cardio + ScanWatch
