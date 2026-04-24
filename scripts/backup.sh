#!/bin/bash
# OpenClaw Backup Script
# Run manually: ./scripts/backup.sh
# Or via cron (weekly): 0 3 * * 0 /path/to/backup.sh

set -e

REPO_DIR="/tmp/openclaw-backup-work"
FINAL_DIR="/tmp/openclaw-backup"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
BACKUP_MSG="Backup $TIMESTAMP"

echo "[$TIMESTAMP] Starting OpenClaw backup..."

mkdir -p "$REPO_DIR"

# --- OpenClaw config (redacted) ---
mkdir -p "$REPO_DIR/openclaw_config"
python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json', 'r') as f:
    config = json.load(f)
providers = config.get('models', {}).get('providers', {})
for prov in providers.values():
    if prov.get('apiKey'):
        prov['apiKey'] = '<REDACTED_API_KEY>'
mcp = config.get('mcp', {}).get('servers', {})
for server in mcp.values():
    env = server.get('env', {})
    for k, v in env.items():
        if k.endswith('_TOKEN') or k.endswith('_PASSWORD') or k.endswith('_KEY') or k.endswith('_SECRET'):
            env[k] = '<REDACTED>'
with open('$REPO_DIR/openclaw_config/openclaw.json', 'w') as f:
    json.dump(config, f, indent=2)
"

# --- Agent workspaces ---
mkdir -p "$REPO_DIR/agent_workspaces"
for agent_dir in $HOME/.openclaw/agents/*/workspace; do
    agent_name=$(basename $(dirname "$agent_dir"))
    mkdir -p "$REPO_DIR/agent_workspaces/$agent_name"
    cp -r "$agent_dir"/* "$REPO_DIR/agent_workspaces/$agent_name/" 2>/dev/null || true
done

# --- Gym logger ---
mkdir -p "$REPO_DIR/gym_logger"
cp -r $HOME/Projects/gym-logger/logs "$REPO_DIR/gym_logger/" 2>/dev/null || true
cp $HOME/Projects/gym-logger/package.json $HOME/Projects/gym-logger/server.js $HOME/Projects/gym-logger/public/index.html "$REPO_DIR/gym_logger/" 2>/dev/null || true

# --- MCP packages list ---
mkdir -p "$REPO_DIR/mcp_servers"
npm list -g --depth=0 2>/dev/null | grep -E "garmin|ultrahuman|polar" > "$REPO_DIR/mcp_servers/npm_packages.txt" || true

# --- Sync to git repo ---
rsync -a --delete "$REPO_DIR/" "$FINAL_DIR/"

cd "$FINAL_DIR"
git config user.name "OpenClaw Backup" 2>/dev/null || true
git config user.email "backup@openclaw" 2>/dev/null || true
git add -A

if git diff --staged --quiet; then
    echo "[$TIMESTAMP] No changes to backup"
else
    git commit -m "$BACKUP_MSG"
    if git push origin main 2>/dev/null; then
        echo "[$TIMESTAMP] Backup pushed successfully"
    else
        echo "[$TIMESTAMP] Backup FAILED to push (check git credentials)"
        exit 1
    fi
fi

echo "[$TIMESTAMP] Backup complete"
