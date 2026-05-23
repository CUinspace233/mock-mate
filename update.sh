#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/root/mock-mate"
NVM_SH="/root/.nvm/nvm.sh"
UV_BIN="${UV_BIN:-}"

echo "[1/5] Pull latest code..."
cd "$APP_DIR"
git pull

echo "[2/5] Update backend dependencies..."
if [[ -z "$UV_BIN" ]]; then
  if [[ -x "/root/.local/bin/uv" ]]; then
    UV_BIN="/root/.local/bin/uv"
  elif command -v uv >/dev/null 2>&1; then
    UV_BIN="$(command -v uv)"
  fi
fi

if [[ -z "$UV_BIN" ]]; then
  echo "uv is not installed or not on PATH"
  exit 1
fi
cd "$APP_DIR/backend"
"$UV_BIN" sync --frozen

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
