#!/data/data/com.termux/files/usr/bin/sh
# Prints the pairing code for Ember (server URL + sync token). Paste it into
# Ember → Settings → Sync on each device. Keep it private: it is the password.
cd "$(dirname "$0")"
TOKEN=$(grep '^SYNC_TOKEN=' .env | cut -d= -f2-)
URL="${PUBLIC_URL:-https://paraesthetic-hilary-guidingly.ngrok-free.dev/habits}"
node -e 'console.log("ember:" + Buffer.from(JSON.stringify({ url: process.argv[1], token: process.argv[2] })).toString("base64url"))' "$URL" "$TOKEN"
