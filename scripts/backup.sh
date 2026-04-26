#!/bin/bash
# OpenClaw Full Backup Script
# Run manually: ./scripts/backup.sh
# Cron: 0 3 * * 0 /path/to/backup.sh >> /tmp/backup.log 2>&1

set -e

BACKUP_DIR="/tmp/openclaw-backup"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
BACKUP_MSG="Full backup $TIMESTAMP"

echo "[$TIMESTAMP] Starting full OpenClaw backup..."

# --- Redact openclaw.json ---
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
with open('$BACKUP_DIR/openclaw_config/openclaw.json', 'w') as f:
    json.dump(config, f, indent=2)
"

# --- Main agent workspace ---
mkdir -p agent_workspaces/main
for f in AGENTS.md SOUL.md USER.md IDENTITY.md TOOLS.md HEARTBEAT.md MEMORY.md BOOTSTRAP.md; do
    [ -f "$HOME/.openclaw/workspace/$f" ] && cp "$HOME/.openclaw/workspace/$f" agent_workspaces/main/ || true
done
[ -d "$HOME/.openclaw/workspace/memory" ] && cp -r "$HOME/.openclaw/workspace/memory" agent_workspaces/main/ || true

# --- Main agent config (redact API keys) ---
mkdir -p agent_workspaces/main/agent
for f in auth-profiles.json models.json auth-state.json; do
    [ -f "$HOME/.openclaw/agents/main/agent/$f" ] && cp "$HOME/.openclaw/agents/main/agent/$f" agent_workspaces/main/agent/ || true
done
# Redact API keys in agent configs
find agent_workspaces -name "*.json" -exec sed -i \
    -e 's/sk-ant-api03-[A-Za-z0-9_-]*/<REDACTED_ANTHROPIC>/g' \
    -e 's/sk-api-NQ-[A-Za-z0-9_-]*/<REDACTED_MINIMAX>/g' \
    {} \;

# --- Fitness coach workspace ---
mkdir -p agent_workspaces/fitness
for workspace in $HOME/.openclaw/agents/*/workspace; do
    agent=$(basename $(dirname "$workspace"))
    mkdir -p "agent_workspaces/$agent"
    for f in AGENTS.md SOUL.md USER.md IDENTITY.md TOOLS.md HEARTBEAT.md DATA_SOURCES.md MEMORY.md BOOTSTRAP.md PLAN.md; do
        [ -f "$workspace/$f" ] && cp "$workspace/$f" "agent_workspaces/$agent/" || true
    done
    [ -d "$workspace/memory" ] && cp -r "$workspace/memory" "agent_workspaces/$agent/" || true
done

# --- Gym logger ---
cp -r $HOME/Projects/gym-logger/logs gym_logger/ 2>/dev/null || true
cp $HOME/Projects/gym-logger/package.json $HOME/Projects/gym-logger/server.js gym_logger/ 2>/dev/null || true
cp $HOME/Projects/gym-logger/public/index.html gym_logger/ 2>/dev/null || true
cp $HOME/Projects/gym-logger/start.sh $HOME/Projects/gym-logger/health-check.sh gym_logger/ 2>/dev/null || true
cp $HOME/Projects/gym-logger/RECOVERY.md gym_logger/ 2>/dev/null || true

# --- MCP packages list ---
npm list -g --depth=0 2>/dev/null | grep -E "garmin|ultrahuman|polar" > mcp_servers/npm_packages.txt || true

# --- Commit and push ---
sed -i "s/Last backup:.*/Last backup: $TIMESTAMP/" README.md 2>/dev/null || true

git add -A
if git diff --staged --quiet; then
    echo "[$TIMESTAMP] No changes"
else
    git commit -m "$BACKUP_MSG"
    git push origin main && echo "[$TIMESTAMP] Pushed" || echo "[$TIMESTAMP] Push failed"
fi

echo "[$TIMESTAMP] Backup complete"

# --- Withings MCP ---
if [ -d "/tmp/withings-mcp" ]; then
    mkdir -p "$REPO_DIR/withings_mcp"
    # Backup tokens (in .env)
    cp /tmp/withings-mcp/.env "$REPO_DIR/withings_mcp/.env" 2>/dev/null || true
    # Backup source (no node_modules)
    cp -r /tmp/withings-mcp/src "$REPO_DIR/withings_mcp/" 2>/dev/null || true
    cp /tmp/withings-mcp/pyproject.toml /tmp/withings-mcp/generate_tokens.py "$REPO_DIR/withings_mcp/" 2>/dev/null || true
fi
