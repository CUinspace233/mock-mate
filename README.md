# mock-mate

![mock-mate icon](./mock-mate-icon.png)

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

Note: You should change the values in the `.env` file to your own.

#### Run

```bash
./run.sh # The port is 5200 by default, you can change it in the script
```
Note: After the application startup complete, it will begin running a task of fetching news for a while

#### API Documentation

Visit [http://localhost:5200/docs](http://localhost:5200/docs) to view the API documentation.

### Frontend

```bash
cd frontend # if you are in the root directory
cp .env.example .env
npm i
```

Note: You should change the values in the `.env` file to your own.

#### Run

```bash
npm run dev
```

## System Architecture (Task Design Document)

See [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)
