#!/bin/bash
# OpenClaw Full Backup Script
# Run manually: ./scripts/backup.sh
# Or via cron (weekly): 0 3 * * 0 /path/to/backup.sh
#
# Backs up: main agent workspace, fitness coach workspace, gym logger,
# OpenClaw config (API keys redacted), startup scripts, this script itself.

set -e

BACKUP_DIR="/tmp/openclaw-backup"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
BACKUP_MSG="Full backup $TIMESTAMP"

echo "[$TIMESTAMP] Starting full OpenClaw backup..."

# --- Redact openclaw.json ---
REDACTED_CONFIG="/tmp/openclaw_backup_config.json"
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
with open('$REDACTED_CONFIG', 'w') as f:
    json.dump(config, f, indent=2)
"

# --- Copy files to backup dir (git repo is the backup dir itself) ---
cd "$BACKUP_DIR"

# OpenClaw config
cp "$REDACTED_CONFIG" openclaw_config/openclaw.json

# Main agent workspace
mkdir -p agent_workspaces/main
for f in AGENTS.md SOUL.md USER.md IDENTITY.md TOOLS.md HEARTBEAT.md MEMORY.md BOOTSTRAP.md; do
    [ -f "$HOME/.openclaw/workspace/$f" ] && cp "$HOME/.openclaw/workspace/$f" agent_workspaces/main/ || true
done
[ -d "$HOME/.openclaw/workspace/memory" ] && cp -r "$HOME/.openclaw/workspace/memory" agent_workspaces/main/ || true

# Main agent agent config
mkdir -p agent_workspaces/main/agent
for f in auth-profiles.json models.json auth-state.json; do
    [ -f "$HOME/.openclaw/agents/main/agent/$f" ] && cp "$HOME/.openclaw/agents/main/agent/$f" agent_workspaces/main/agent/ || true
done

# Fitness coach workspace
mkdir -p agent_workspaces/fitness
for f in AGENTS.md SOUL.md USER.md IDENTITY.md TOOLS.md HEARTBEAT.md DATA_SOURCES.md MEMORY.md BOOTSTRAP.md PLAN.md; do
    for workspace in $HOME/.openclaw/agents/*/workspace; do
        agent=$(basename $(dirname "$workspace"))
        [ -f "$workspace/$f" ] && cp "$workspace/$f" "agent_workspaces/$agent/" || true
    done
done
# Memory folders
for workspace in $HOME/.openclaw/agents/*/workspace; do
    agent=$(basename $(dirname "$workspace"))
    [ -d "$workspace/memory" ] && cp -r "$workspace/memory" "agent_workspaces/$agent/" || true
done

# Gym logger
cp -r $HOME/Projects/gym-logger/logs gym_logger/ 2>/dev/null || true
cp $HOME/Projects/gym-logger/package.json $HOME/Projects/gym-logger/server.js gym_logger/ 2>/dev/null || true
cp $HOME/Projects/gym-logger/public/index.html gym_logger/ 2>/dev/null || true
cp $HOME/Projects/gym-logger/start.sh $HOME/Projects/gym-logger/health-check.sh gym_logger/ 2>/dev/null || true
cp $HOME/Projects/gym-logger/RECOVERY.md gym_logger/ 2>/dev/null || true

# This script (keep it updated)
cp scripts/backup.sh scripts/backup.sh.bak 2>/dev/null || true

# Update README timestamp
sed -i "s/Last backup:.*/Last backup: $TIMESTAMP/" README.md 2>/dev/null || true

# --- Commit and push ---
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
        echo "[$TIMESTAMP] Backup FAILED to push"
        exit 1
    fi
fi

echo "[$TIMESTAMP] Backup complete"

# Also redact agent config files (API keys)
find agent_workspaces -name "*.json" -exec sed -i \
    -e 's/sk-ant-api03-[A-Za-z0-9_-]*/<REDACTED_ANTHROPIC>/g' \
    -e 's/sk-api-NQ-[A-Za-z0-9_-]*/<REDACTED_MINIMAX>/g' \
    {} \;
