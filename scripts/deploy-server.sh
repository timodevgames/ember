#!/bin/sh
# Build habits-api and ship it to the Pixel (ssh alias "termux"), then prove the
# new build is live via /health — scp alone changes nothing for a running pm2 app.
set -e
cd "$(dirname "$0")/.."
node scripts/build-server.mjs
REMOTE=apps/habits-api
ssh termux "mkdir -p ~/$REMOTE/data"
scp -q server/dist/index.mjs server/pairing.sh termux:$REMOTE/
ssh termux "cd ~/$REMOTE && node --check index.mjs && test -f .env && \
  (pm2 describe habits-api >/dev/null 2>&1 && pm2 restart habits-api --update-env >/dev/null || \
   pm2 start index.mjs --name habits-api --node-args='--env-file=.env' >/dev/null) && \
  sleep 2 && curl -s --max-time 5 http://127.0.0.1:3040/health; echo"
