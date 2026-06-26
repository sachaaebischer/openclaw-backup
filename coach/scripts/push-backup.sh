#!/usr/bin/env bash
set -e
PAT="$(cat ~/.openclaw/github_pat 2>/dev/null || echo '')"
if [ -z "$PAT" ]; then
  echo 'Error: no PAT found. Put it in ~/.openclaw/github_pat'
  exit 1
fi
cd /tmp
rm -rf coach-backup-push
git clone "https://sachaaebischer:${PAT}@github.com/sachaaebischer/openclaw-backup.git" coach-backup-push
rsync -a --delete \
  --exclude='node_modules/' --exclude='dist/' --exclude='.next/' \
  --exclude='*.tsbuildinfo' --exclude='.DS_Store' --exclude='*.log' \
  --exclude='sync.log' --exclude='.claude/' \
  --exclude='data/raw/' --exclude='data/health/' \
  --exclude='data/activities/' --exclude='data/gym/sessions/' \
  --exclude='data/gym/*.csv' --exclude='data/state/' \
  --exclude='data/plan/' \
  ~/coach/ coach-backup-push/coach/
cd coach-backup-push
git config user.email 'sacha.aebischer@gmail.com'
git config user.name 'Sacha Aebischer'
git add coach/
git diff --cached --quiet && echo 'nothing changed' && exit 0
git commit -m "coach: update $(date +%Y-%m-%d)"
git push origin main
echo 'pushed ok'
rm -rf /tmp/coach-backup-push
