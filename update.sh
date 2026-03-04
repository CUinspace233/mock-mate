#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/root/mockmate/app"
CONDA_SH="/root/miniconda3/etc/profile.d/conda.sh"
NVM_SH="/root/.nvm/nvm.sh"

echo "[1/5] Pull latest code..."
cd "$APP_DIR"
git pull

echo "[2/5] Update backend dependencies..."
if [[ ! -f "$CONDA_SH" ]]; then
  echo "Conda init script not found: $CONDA_SH"
  exit 1
fi
source "$CONDA_SH"
conda activate mockmate
cd "$APP_DIR/backend"
uv sync

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
