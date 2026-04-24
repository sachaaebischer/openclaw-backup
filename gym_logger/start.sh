#!/bin/bash
# Gym Logger startup script
# Run on boot or manually to start the gym logger

export TZ=Europe/Zurich
cd ~/Projects/gym-logger

# Check if already running
if pgrep -f "node server.js" > /dev/null; then
    echo "Gym logger already running"
    exit 0
fi

nohup node server.js > /tmp/gymlogger.log 2>&1 &
echo "Gym logger started (PID: $!)"
