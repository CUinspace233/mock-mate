#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/root/mock-mate"
NVM_SH="/root/.nvm/nvm.sh"

echo "[1/5] Pull latest code..."
cd "$APP_DIR"
git pull

echo "[2/5] Update backend dependencies..."
if ! command -v uv >/dev/null 2>&1; then
  echo "uv is not installed or not on PATH"
  exit 1
fi
cd "$APP_DIR/backend"
uv sync --frozen

echo "[3/5] Restart backend service..."
systemctl restart mockmate

echo "[4/5] Rebuild frontend..."
if [[ ! -f "$NVM_SH" ]]; then
  echo "nvm init script not found: $NVM_SH"
  exit 1
fi
source "$NVM_SH"
nvm use 20 >/dev/null
cd "$APP_DIR/frontend"
npm install
npm run build

echo "[5/5] Done."
echo "Deployment update completed successfully."
