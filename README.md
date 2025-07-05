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
Note: After the application startup complete, it will start running a task of fetching news for a while.

During the fetching (around 1 min), api requests might be slow.

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

## System Architecture (Task Design Document)

See [MockMate - Interview Simulation System Architecture](https://github.com/CUinspace233/mock-mate/wiki/Mock-Mate-%E2%80%90-Interview-Simulation-System-Architecture)

For more fancy documentation, please visit this repo's [DeepWiki](https://deepwiki.com/CUinspace233/mock-mate) !
