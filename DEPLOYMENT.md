# MockMate Ubuntu Server Deployment Guide

> Root user deployment with nvm, miniconda, Nginx, Let's Encrypt.
>
> Replace `mockmate.example.com` with your actual domain throughout this guide.

## 1. Domain DNS Configuration

Go to your domain registrar's DNS management panel (e.g. Cloudflare, Namecheap, GoDaddy, Aliyun) and add an **A record**:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `mockmate` (or `@` for root domain) | Your server's public IP | 600 or Auto |

- If your domain is `example.com` and you want to use `mockmate.example.com`, set Name to `mockmate`
- If you want to use the root domain `example.com` directly, set Name to `@`
- If using Cloudflare, turn **off** the proxy (grey cloud) during initial setup so Certbot can verify the domain. You can enable it later.

Verify DNS propagation:

```bash
# Run this from any machine
ping mockmate.example.com
# Should resolve to your server IP

# Or use dig
dig mockmate.example.com +short
```

Wait until DNS resolves correctly before proceeding (usually 1-10 minutes, can take up to 48 hours).

## 2. Server Base Setup

```bash
apt update && apt upgrade -y
apt install -y git curl wget build-essential software-properties-common nginx
```

## 3. Install Node.js via nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc

nvm install 20
nvm alias default 20

# Verify
node -v
npm -v
```

## 4. Install Python via Miniconda

```bash
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b -p /root/miniconda3
rm Miniconda3-latest-Linux-x86_64.sh
/root/miniconda3/bin/conda init bash
source ~/.bashrc

conda create -n mockmate python=3.12 -y
conda activate mockmate
pip install uv

# Verify
python --version
```

## 5. Clone and Setup Project

```bash
mkdir -p /root/mockmate
cd /root/mockmate
git clone https://github.com/CUinspace233/mock-mate.git app
cd app
```

### 5.1 Backend

```bash
cd /root/mockmate/app/backend
conda activate mockmate
uv sync

# Create .env
cat > .env << 'EOF'
OPENAI_API_KEY=sk-your-actual-openai-key
NEWS_FETCH_USER_AGENT="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
EOF

chmod 600 .env

# Quick test
uvicorn main:app --host 127.0.0.1 --port 5200 &
curl http://127.0.0.1:5200/health
# Should return: {"status":"healthy","version":"1.0.0"}
kill %1
```

### 5.2 Frontend

```bash
cd /root/mockmate/app/frontend

# IMPORTANT: Set your actual domain here
cat > .env << 'EOF'
VITE_API_URL=https://mockmate.example.com
EOF

npm install
npm run build
# Output in frontend/dist/
```

## 6. Create systemd Service

Find the exact paths first:

```bash
which uvicorn
# Should be something like: /root/miniconda3/envs/mockmate/bin/uvicorn

node -e "console.log(process.execPath)"
# Should be something like: /root/.nvm/versions/node/v20.x.x/bin/node
```

Create the service file (adjust paths if different):

```bash
cat > /etc/systemd/system/mockmate.service << 'EOF'
[Unit]
Description=MockMate Backend API
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/mock-mate/backend
Environment=HOME=/root
Environment=LANG=en_US.UTF-8
Environment=PYTHONIOENCODING=utf-8
Environment=PATH=/root/miniconda3/envs/mockmate/bin:/root/.nvm/versions/node/v20.20.0/bin:/usr/local/bin:/usr/bin
ExecStart=/root/miniconda3/envs/mockmate/bin/uvicorn main:app --host 127.0.0.1 --port 5200
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mockmate
systemctl start mockmate

# Verify
systemctl status mockmate
curl http://127.0.0.1:5200/health
```

## 7. Configure Nginx

```bash
cat > /etc/nginx/sites-available/mockmate << 'NGINX'
server {
    listen 80;
    server_name mockmate.example.com;

    # Frontend static files
    root /root/mockmate/app/frontend/dist;
    index index.html;

    # SPA: all frontend routes fallback to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy backend API
    location /api/ {
        proxy_pass http://127.0.0.1:5200/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE streaming support (for /api/questions/generate/stream)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    # Backend health check
    location /health {
        proxy_pass http://127.0.0.1:5200/health;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/mockmate /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Verify HTTP access:

```bash
curl http://mockmate.example.com/health
# Should return: {"status":"healthy","version":"1.0.0"}
```

## 8. SSL Certificate with Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx

# Request certificate (will auto-modify Nginx config)
certbot --nginx -d mockmate.example.com
# Follow the prompts, enter your email, agree to ToS

# Verify auto-renewal
certbot renew --dry-run
```

After Certbot completes, it will automatically:
- Add `listen 443 ssl` with certificate paths
- Add HTTP -> HTTPS redirect

Verify HTTPS:

```bash
curl https://mockmate.example.com/health
```

## 9. Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

## 10. Final Verification

```bash
# Backend API
curl https://mockmate.example.com/api/health

# Open in browser
# https://mockmate.example.com
```

You should see the MockMate login page.

---

## Maintenance

### View logs

```bash
# Backend application logs
journalctl -u mockmate -f

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log
```

### Update code and redeploy

```bash
cd /root/mockmate/app
chmod +x update.sh
./update.sh
```

### Restart services

```bash
systemctl restart mockmate    # Backend
systemctl reload nginx        # Nginx (no downtime)
```

### Renew SSL certificate

Certbot sets up a systemd timer for auto-renewal. To manually renew:

```bash
certbot renew
```

### Database

The SQLite database is at `backend/database/mockmate.db`. To back up:

```bash
cp /root/mockmate/app/backend/database/mockmate.db /root/mockmate/backup/mockmate-$(date +%Y%m%d).db
```

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| 502 Bad Gateway | `systemctl status mockmate` - backend might be down |
| SSL certificate error | `certbot renew` - certificate might have expired |
| DNS not resolving | Verify A record at your registrar, wait for propagation |
| Backend won't start | `journalctl -u mockmate -e` - check error logs |
| Frontend shows blank page | Check `frontend/.env` has correct `VITE_API_URL`, rebuild |
| API returns CORS error | Backend CORS is set to `allow_origins=["*"]`, check Nginx proxy headers |
| SSE streaming not working | Verify `proxy_buffering off` in Nginx config |

## Architecture Overview

```
Browser (HTTPS)
    │
    ▼
Nginx (:443)
    ├── /          → frontend/dist/ (static files)
    ├── /api/*     → proxy to backend :5200
    └── /health    → proxy to backend :5200
          │
          ▼
    Uvicorn (:5200)
      FastAPI App
          │
          ├── SQLite (database/mockmate.db)
          ├── OpenAI API (question generation & evaluation)
          └── APScheduler (news fetch every 4h)
```
