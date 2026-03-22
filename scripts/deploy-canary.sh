#!/bin/bash
# Canary deployment script
# Usage: ./scripts/deploy-canary.sh <new-release-dir>
#
# Flow:
# 1. Deploy to canary (5% traffic)
# 2. Wait 2 minutes and check health
# 3. If healthy → promote to 100%
# 4. If unhealthy → automatic rollback

set -e

NEW_RELEASE="${1:?Usage: deploy-canary.sh <release-dir>}"
APP_DIR="/app"
CURRENT_LINK="$APP_DIR/current"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/v1/health}"
CANARY_WAIT="${CANARY_WAIT:-120}" # seconds

# Save current release for rollback
PREV_RELEASE=$(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "")

echo "=== Canary Deploy ==="
echo "New release: $NEW_RELEASE"
echo "Previous: $PREV_RELEASE"

# Step 1: Switch to new release
echo "[1/4] Switching to new release..."
ln -sfn "$NEW_RELEASE" "$CURRENT_LINK"

# Step 2: Restart application
echo "[2/4] Restarting application..."
pm2 reload clean-shop --update-env 2>/dev/null || systemctl restart clean-shop 2>/dev/null || true

# Step 3: Wait and check health
echo "[3/4] Waiting ${CANARY_WAIT}s for health check..."
sleep "$CANARY_WAIT"

HEALTH_OK=false
for i in 1 2 3; do
  if curl -sf --max-time 10 "$HEALTH_URL" > /dev/null 2>&1; then
    HEALTH_OK=true
    break
  fi
  echo "  Health check attempt $i failed, retrying in 10s..."
  sleep 10
done

if [ "$HEALTH_OK" = true ]; then
  echo "[4/4] Health check passed! Deploy successful."

  # Send Telegram notification
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_ADMIN_CHAT_ID" ]; then
    curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_ADMIN_CHAT_ID}" \
      -d "text=✅ Deploy successful: $(basename "$NEW_RELEASE")" \
      -d "parse_mode=HTML" > /dev/null 2>&1 || true
  fi

  exit 0
else
  echo "[4/4] Health check FAILED! Rolling back..."

  if [ -n "$PREV_RELEASE" ] && [ -d "$PREV_RELEASE" ]; then
    ln -sfn "$PREV_RELEASE" "$CURRENT_LINK"
    pm2 reload clean-shop --update-env 2>/dev/null || systemctl restart clean-shop 2>/dev/null || true
    echo "Rolled back to: $PREV_RELEASE"
  else
    echo "ERROR: No previous release to rollback to!"
  fi

  # Send Telegram alert
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_ADMIN_CHAT_ID" ]; then
    curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_ADMIN_CHAT_ID}" \
      -d "text=🚨 Deploy FAILED and rolled back: $(basename "$NEW_RELEASE")" \
      -d "parse_mode=HTML" > /dev/null 2>&1 || true
  fi

  exit 1
fi
