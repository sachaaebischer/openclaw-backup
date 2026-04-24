#!/bin/bash
# Health check for gym logger and MCP servers
# Add to crontab: */30 * * * * /home/sacha/Projects/gym-logger/health-check.sh

GYM_URL="http://localhost:3000"
LOG_FILE="/tmp/health-check.log"
TELEGRAM_CHAT_ID="7789196354"
BOT_TOKEN="8357659123:AAFm_WLG2XzfB6lSf_7BhQHurhQYh9Ep3Ik"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M')] $1" >> "$LOG_FILE"
}

# Check gym logger
if curl -sf "$GYM_URL" > /dev/null 2>&1; then
    log "Gym logger: OK"
else
    log "Gym logger: DOWN - restarting"
    cd ~/Projects/gym-logger && TZ=Europe/Zurich nohup node server.js > /tmp/gymlogger.log 2>&1 &
    sleep 2
    if curl -sf "$GYM_URL" > /dev/null 2>&1; then
        log "Gym logger: restarted successfully"
        # Notify via Telegram fitness bot
        curl -s "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=⚠️ Gym logger crashed - automatically restarted" > /dev/null 2>&1
    else
        log "Gym logger: restart FAILED"
        curl -s "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=🚨 Gym logger DOWN and could not restart - manual intervention needed" > /dev/null 2>&1
    fi
fi
