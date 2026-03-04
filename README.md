# mock-mate

![mock-mate icon](./mock-mate-icon.png)

[![This repo is indexed by DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/CUinspace233/mock-mate)

## Introduction

**MockMate** is a comprehensive **interview practice** platform that simulates real-world technical interviews. The system combines AI-powered question generation, automated answer evaluation, and trending news-based interview questions to provide an up-to-date and realistic interview experience.

## Setup

### Prerequisites

- Python 3.10+ (3.12 is recommended)
- Node.js 18+ (20+ is recommended)
- npm 10+
- uv (if you don't have uv installed, you can install it with `pip install uv`)

### Backend

```bash
cd backend
cp .env.example .env
uv venv
source .venv/bin/activate # might be different on your system, but uv will tell you the correct command
uv sync
```

Note: You should change the `OPENAI_API_KEY` in the `.env` file to your own.

For `NEWS_FETCH_USER_AGENT` in `.env`, you might not need to change it, but if the news fetching is not working, you can try to change it to your own browser's user agent. (Simply google "my browser user agent")

#### Run in development mode

```bash
./run.sh # The port is 5200 by default, you can change it in the script
```

#### API Documentation

Visit [http://localhost:5200/docs](http://localhost:5200/docs) to view the API documentation.

### Frontend

```bash
cd frontend # if you are in the root directory
cp .env.example .env
npm i
```

Note: You can change the values in the `.env` file to your own.

#### Run in development mode

The port is `1314` by default, you can change it in `vite.config.ts`

```bash
npm run dev
```

## Production Update Script

For the Ubuntu server deployment flow, this repo provides a one-click update script: `update.sh`.

It is designed for the deployment layout described in `DEPLOYMENT.md` (`/root/mockmate/app`) and will:
- Pull latest code (`git pull`)
- Sync backend dependencies (`uv sync`)
- Restart backend service (`systemctl restart mockmate`)
- Rebuild frontend assets (`npm install` and `npm run build`)

Usage on server:

```bash
cd /root/mockmate/app
chmod +x update.sh
./update.sh
```

Notes:
- Run as a user with permission to restart systemd services (usually `root`)
- Requires the same `conda`/`nvm` environment paths used in `DEPLOYMENT.md`

## Database Maintenance

The system automatically fetches news and generates interview questions on a schedule. Over time this data accumulates. A scheduled task runs every 24 hours to clean up expired data (default retention: 30 days). You can also run the cleanup manually:

```bash
cd backend

# Preview what would be deleted (no changes made)
python cleanup_news.py --dry-run

# Clean up with default 30-day retention
python cleanup_news.py

# Custom retention period
python cleanup_news.py --days 7
```

To change the default retention period, set the `NEWS_RETENTION_DAYS` environment variable in your `.env` file:

```env
NEWS_RETENTION_DAYS=14
```

The cleanup process:
1. Deletes expired `NewsBasedQuestion` and associated `Question` records
2. Skips questions that have been used in user interview sessions
3. Deletes expired `NewsItem` records
4. Runs SQLite `VACUUM` to reclaim disk space

## System Architecture (Task Design Document)

See [MockMate - Interview Simulation System Architecture](https://github.com/CUinspace233/mock-mate/wiki/Mock-Mate-%E2%80%90-Interview-Simulation-System-Architecture)

For more fancy documentation, please visit this repo's [DeepWiki](https://deepwiki.com/CUinspace233/mock-mate) !
