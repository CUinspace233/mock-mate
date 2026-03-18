# MockMate

![mock-mate icon](./mock-mate-icon.png)

[![This repo is indexed by DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/CUinspace233/mock-mate)

## Introduction

**MockMate** is an AI-powered interview practice platform that simulates real-world technical interviews. It features **streaming question generation with incremental persistence**, multi-turn follow-up conversations, structured answer evaluation, session recovery, and trending news-based interview questions — all designed for a realistic and resilient interview experience.

### Key Features

- **Streaming AI Questions** — Real-time SSE streaming with background persistence; generation continues server-side even if you close the tab
- **Multi-turn Follow-ups** — AI probes deeper with follow-up questions based on your answers
- **Structured Evaluation** — Scoring across technical accuracy, communication clarity, completeness, and practical experience
- **Session Recovery** — Refresh or return later; your interview session and questions are restored from the server
- **News-based Questions** — Trending tech news automatically generates relevant interview questions
- **Configurable** — Choose position, difficulty, question type, language, OpenAI model, and follow-up depth

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Backend | Python 3.12+, FastAPI, async SQLAlchemy, SQLite, OpenAI Responses API |
| Frontend | React 19, TypeScript, Vite, Joy UI, Zustand, react-markdown |
| AI | OpenAI Responses API (default: `gpt-4.1-nano`, configurable per-request) |
| Scheduling | APScheduler (news fetching every 4h, cleanup every 24h) |

## Setup

### Prerequisites

- Python 3.10+ (3.12 recommended)
- Node.js 18+ (20+ recommended)
- npm 10+
- uv (`pip install uv` if not installed)

### Backend

```bash
cd backend
cp .env.example .env
uv venv
source .venv/bin/activate
uv sync
```

Edit `.env` and set your `OPENAI_API_KEY`. Alternatively, users can enter their own API key in the frontend UI.

For `NEWS_FETCH_USER_AGENT`, the default usually works. If news fetching fails, replace it with your browser's user agent.

#### Run in development mode

```bash
./run.sh  # uvicorn dev server on :5200 with --reload
```

#### API Documentation

Visit [http://localhost:5200/docs](http://localhost:5200/docs) for the interactive Swagger docs.

### Frontend

```bash
cd frontend
cp .env.example .env
npm i
```

#### Run in development mode

```bash
npm run dev  # Vite dev server on :1314
```

## Production Deployment

For Ubuntu server deployment, see [`DEPLOYMENT.md`](./DEPLOYMENT.md). A one-click update script is provided:

```bash
cd /root/mockmate/app
chmod +x update.sh
./update.sh
```

This will pull latest code, sync backend dependencies, restart the backend service, and rebuild frontend assets.

## Database Maintenance

News data accumulates over time. A scheduled task cleans up expired data every 24h (default retention: 30 days). Manual cleanup:

```bash
cd backend

# Preview (no changes)
python cleanup_news.py --dry-run

# Clean up with default 30-day retention
python cleanup_news.py

# Custom retention
python cleanup_news.py --days 7
```

Set `NEWS_RETENTION_DAYS` in `.env` to change the default. The cleanup deletes expired news questions (skipping those used in sessions), expired news items, and runs SQLite `VACUUM`.

## Architecture

See [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) for the full system design, including:
- Streaming generation architecture (background thread + async flush task + SSE)
- Session recovery flow
- Follow-up conversation system
- News processing pipeline

For interactive documentation, visit this repo's [DeepWiki](https://deepwiki.com/CUinspace233/mock-mate).
