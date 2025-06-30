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
uv sync
```

Note: Change the values in the `.env` file to your own.

#### Run

```bash
./run.sh
```


### Frontend

```bash
cd frontend # if you are in the root directory
cp .env.example .env
npm i
```

Note: Change the values in the `.env` file to your own.

#### Run

```bash
npm run dev
```