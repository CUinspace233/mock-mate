# MockMate - Interview Simulation System Architecture

## Overview

MockMate is a comprehensive interview practice platform that simulates real-world technical interviews. The system combines AI-powered question generation with incremental streaming persistence, automated answer evaluation, multi-turn follow-up conversations, resume-based project drilling, and trending news-based interview questions to provide an up-to-date and realistic interview experience.

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend runtime | Python | ≥3.12 |
| Backend framework | FastAPI | ≥0.115 |
| ORM | SQLAlchemy (async) + aiosqlite | ≥2.0 |
| AI SDK | OpenAI Python SDK (Responses API) | ≥1.93 |
| Scheduler | APScheduler (AsyncIOScheduler) | ≥3.10 |
| Frontend | React + TypeScript | 19 / ~5.8 |
| Build tool | Vite | 7 |
| UI | MUI Joy (+ Material, X-Charts) | Joy 5 beta |
| State | Zustand (persisted) | 5 |
| Database | SQLite (`database/mockmate.db`) | — |

## Directory Layout

```
mock-mate/
├── backend/
│   ├── main.py                    # FastAPI entry + lifespan
│   ├── scheduler.py               # APScheduler jobs
│   ├── cleanup_news.py            # Standalone news cleanup script
│   ├── api/
│   │   ├── deps.py                # get_db() dependency
│   │   └── endpoints/             # user, questions, answers, sessions, trending, resume
│   ├── database/                  # models, schemas, session
│   └── utility/settings.py        # Pydantic Settings from .env
├── frontend/src/
│   ├── App.tsx, pages/Home.tsx
│   ├── components/                # Interview UI + resume-drill/
│   ├── stores/                    # useAuthStore, useNewsQuestionPushStore
│   ├── api/api.ts                 # Axios REST + fetch SSE
│   ├── hooks/                     # useDebounce, useSpeechRecognition
│   ├── services/                  # newsQuestionPushService
│   ├── crypto.ts                  # AES-GCM API key encryption
│   └── types/interview.ts
└── shared/interview_positions.json  # Preset job roles (frontend + backend)
```

## System Architecture

### Backend (Python FastAPI)

#### Core Components

1. **FastAPI Application** (`main.py`)
   - CORS enabled (allow all origins/methods/headers)
   - Lifecycle management for database initialization and scheduler startup
   - Startup migration: `ALTER TABLE` for schema evolution on existing SQLite databases (`questions.status`, `questions.session_id`, `resumes.extraction_status`)
   - Stale question cleanup: marks any `status="generating"` questions as `"interrupted"` on startup (crash recovery)
   - Modular router-based architecture under `/api/*`
   - Health endpoints: `GET /`, `GET /health`

2. **Database Layer**
   - **SQLAlchemy ORM** with async support (`AsyncSessionLocal`)
   - **SQLite database** (`database/mockmate.db`) for data persistence
   - Comprehensive schema with proper relationships
   - No migration system — uses `Base.metadata.create_all()` with manual `ALTER TABLE` for new columns

3. **Settings** (`utility/settings.py`)
   - Pydantic Settings loaded from `backend/.env`
   - Configurable: `OPENAI_API_KEY`, `DATABASE_URL`, `NEWS_RETENTION_DAYS`, `NEWS_FETCH_USER_AGENT`, server bind/port, CORS

#### Key Data Models

```
User (1) ──< InterviewSession
User (1) ──< InterviewRecord
User (1) ──o UserPreferences
User (1) ──o Resume

InterviewSession (1) ──< InterviewRecord
InterviewSession (1) ──< Question (via session_id FK)

Question (1) ──< InterviewRecord
Question (1) ──< AnswerEvaluation
Question (1) ──o NewsBasedQuestion

NewsSource (1) ──< NewsItem (1) ──< NewsBasedQuestion ──> Question
```

1. **User Management**
   - `User`: Core user information with SHA-256 password hashing
   - `UserPreferences`: Personalized settings (position, difficulty, daily goal, notification settings)

2. **Interview System**
   - `InterviewSession`: Tracks sessions with `status` (active/completed), `session_type` (practice/mock_interview/resume_drill), and timing
   - `InterviewRecord`: Individual question-answer pairs with score, feedback, and `evaluation_details` JSON
   - `Question`: Core question repository with metadata, `status` field (`generating`/`completed`/`interrupted`/`discarded`), and `session_id` FK linking to `InterviewSession`
   - `AnswerEvaluation`: Detailed per-answer AI assessment snapshot (strengths, improvements, keyword coverage)

3. **Resume Drill**
   - `Resume`: One resume per user — `content_text`, `projects_json` (AI-extracted projects), `extraction_status` (ai/fallback/unknown)

4. **News Integration**
   - `NewsSource`: RSS feeds and API endpoints configuration with `last_fetched` timestamp
   - `NewsItem`: Individual news articles with processing status
   - `NewsBasedQuestion`: AI-generated questions from current events with `relevance_score` and `ai_reasoning`

#### API Endpoints Structure

**User Management** (`/api/users`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/register` | Register user + default preferences |
| POST | `/login` | Login (SHA-256 password check) |
| GET | `/` | List all users |
| GET | `/{user_id}` | Get user by ID |
| GET | `/{user_id}/interview-records` | Paginated interview history (filters: position, dates) |
| POST | `/{user_id}/interview-records` | Save interview record after evaluation |
| GET | `/{user_id}/progress` | Progress analytics (7/30/90 days) |
| GET | `/{user_id}/preferences` | Get preferences (auto-create defaults) |
| PUT | `/{user_id}/preferences` | Update preferences |

**Questions** (`/api/questions`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/generate/stream` | SSE stream new question (practice mode) |
| POST | `/generate/followup/stream` | SSE stream follow-up question |
| POST | `/generate/resume/stream` | SSE resume drill question (project-scoped) |
| POST | `/generate/resume/followup/stream` | SSE resume drill follow-up (depth/shift logic) |
| POST | `/generate` | Non-streaming question generation (fallback) |
| GET | `/recover` | Recover session questions (`session_id`, `include_completed`) |
| POST | `/{question_id}/discard` | Mark question as discarded |
| GET | `/categories` | Position/type counts |
| GET | `/{question_id}` | Get question by ID |

**Answers** (`/api/answers`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/evaluate` | Single-turn AI evaluation with structured JSON output |
| POST | `/evaluate/followup` | Multi-turn holistic conversation evaluation |

**Sessions** (`/api/sessions`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/start` | Start interview session (practice / mock_interview / resume_drill) |
| PUT | `/{session_id}/complete` | Complete session + summary (count, avg score, duration) |
| GET | `/{session_id}` | Session details + record count |

**Trending Questions** (`/api/trending`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/fetch-news` | Trigger background news fetch + question generation |
| GET | `/trending-questions` | Get news-based trending questions |
| GET | `/news-sources` | List active news sources |
| POST | `/scheduled-fetch` | Cron-style news fetch trigger |

**Resume** (`/api/resume`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/current` | Get user's resume (`user_id` query param) |
| POST | `/upload` | Upload + parse resume (PDF/TXT/MD, multipart form) |
| DELETE | `/current` | Delete user's resume |

#### Preset Positions

Eleven preset roles are defined in `shared/interview_positions.json` and shared between frontend and backend:

`agent`, `frontend`, `backend`, `fullstack`, `mobile`, `devops`, `ai`, `qa`, `product`, `ui`, `data`

Users can also enter a custom position string for question generation.

### Streaming Question Generation Architecture

The streaming system decouples the OpenAI generation from the SSE client connection, enabling **incremental persistence** and **server-side continuation** even when the client disconnects.

#### Components

```
[Background Thread]          [Async Flush Task]          [SSE Generator]
  OpenAI stream       →     _GenerationState      ←     reads & yields
  writes deltas              (thread-safe)               to client
                                   ↓
                             Periodic DB flush
                             (sentence boundaries
                              or every ~1s)
```

1. **`_GenerationState`**: Thread-safe shared state (deltas list, accumulated content, done/error flags, `response_id`) protected by `threading.Lock`
2. **`_run_openai_stream_in_thread()`**: Runs the synchronous `client.responses.stream()` in a daemon thread; writes deltas into shared state
3. **`_bg_flush_task()`**: `asyncio.create_task` that periodically flushes content to DB via its own `AsyncSessionLocal` session. **Survives SSE client disconnect.** Flush triggers on sentence boundaries (`.?!。？！`) or time-based floor (≥1s)
4. **SSE Generator** (`sse_iter()`): Polls shared state every 50ms, yields deltas as SSE events. Cancellation-safe — if the client disconnects, the thread and flush task continue independently

The same streaming architecture is reused for practice questions, follow-ups, and resume drill questions.

#### SSE Event Protocol

```
event: init       → {"question_id": "uuid"}        # Sent immediately after DB insert
event: content    → {"delta": "text chunk"}         # Repeated for each token
event: final      → {full question metadata}        # After generation completes
event: error      → {"error": "message"}            # On failure
event: end        → {}                              # Stream termination
```

#### Question Lifecycle

```
[DB INSERT status=generating, content=""]
  → incremental content flushes (sentence/time boundaries)
  → [stream completes] → status=completed, full content
  → [stream errors]    → status=interrupted, partial content
  → [user abandons]    → status=discarded (via /discard endpoint)
  → [server restart]   → startup cleanup marks generating → interrupted
```

### Session Recovery

When a user refreshes or returns to the page:

1. **Frontend** detects `sessionId` in Zustand (persisted to localStorage) but `interviewStarted=false`
2. Calls `GET /api/sessions/{sessionId}` to check if session is still `active`
3. If active: calls `GET /api/questions/recover?session_id=xxx&include_completed=true` to fetch all questions
4. Restores messages from completed questions, sets `isRecoveredSession=true` to skip auto-generation
5. If session completed or not found: clears stale `sessionId`

Resume drill has a parallel recovery path: draft state is persisted in localStorage per user and validated against the active `resume_drill` session on page load.

### Follow-up Conversation System

After answering a question, the system can generate follow-up questions that probe deeper:

1. **Conversation history** is tracked client-side as `ConversationEntry[]` (role: interviewer/candidate)
2. Follow-ups are generated via `/generate/followup/stream` with full conversation context
3. Each follow-up is a separate `Question` record linked to the same session
4. After reaching the configurable follow-up limit (default 2), a comprehensive multi-turn evaluation is performed via `/evaluate/followup`

### Resume Drill System

Resume drill lets users practice answering questions grounded in their own project experience:

1. **Upload**: `POST /api/resume/upload` accepts PDF/TXT/MD (max 5 MB). Text is extracted (pypdf for PDF) and sent to OpenAI with a strict `json_schema` to extract structured projects (name, role, tech stack, summary, evidence). Retries up to 3 times; falls back to heuristic extraction on failure.
2. **Project selection**: User picks a project from the extracted list in `ResumeDrillSidebar`.
3. **Session**: `POST /api/sessions/start` with `session_type=resume_drill`.
4. **Question generation**: `/generate/resume/stream` produces project-scoped technical questions; `/generate/resume/followup/stream` handles depth probing and topic shifts within the project context.
5. **Draft persistence**: In-progress drill state saved to localStorage per user; restored on page reload if the session is still active.
6. **Evaluation**: Same `/evaluate` and `/evaluate/followup` endpoints as practice mode; records saved via `/api/users/{id}/interview-records`.

### Scheduled Tasks Logic

#### News Processing Scheduler (`scheduler.py`)

**Architecture:**
- Uses `AsyncIOScheduler` from APScheduler
- Runs as background service during application lifecycle
- Direct database access (bypasses HTTP layer for efficiency)
- Job defaults: `max_instances=1`, `coalesce=True`, `misfire_grace_time=60`

**Jobs:**

| Job | Interval | Purpose |
|---|---|---|
| `fetch_news_task` | Every 4h (runs immediately on startup) | Fetch news + generate AI questions. Skips if any source was fetched within last 4h. |
| `cleanup_news_task` | Every 24h | Delete expired news data (retention via `NEWS_RETENTION_DAYS`, default 30) + SQLite `VACUUM` |

**News Fetch Execution Flow:**
1. Fetch from predefined sources by category (Dev.to RSS + Hacker News Algolia API)
2. Parse content with proper error handling and custom User-Agent headers
3. For each news item × relevant position: generate interview question via `AsyncOpenAI` (`asyncio.gather` for parallelism)
4. Calculate relevance score; skip questions below threshold (0.4)
5. Persist news items, sources, and linked `NewsBasedQuestion` + `Question` records

**News Sources Configuration** (`NEWS_SOURCES` in `trending.py`):
- **AI**: Dev.to AI RSS + Hacker News Algolia (AI query)
- **Web Development**: Dev.to webdev RSS
- **Mobile Development**: Dev.to mobile RSS
- **DevOps**: Dev.to devops RSS

**Position-to-Category Mapping**: Each news category maps to relevant preset positions (e.g., AI → `ai`, `agent`; Web Dev → `frontend`, `backend`, `fullstack`; General Tech → `product`, `qa`, `data`).

A standalone `cleanup_news.py` script is also available for manual cleanup with `--dry-run` and `--days` flags.

### Frontend (React + TypeScript + Joy UI)

#### Architecture
- **React 19** with TypeScript for type safety
- **Vite 7** for build tooling and development (dev server on `:1314`)
- **Zustand** for client-side state management and persistence
- **Joy UI** for UI components; **MUI X-Charts** for progress analytics
- **react-markdown** for AI message rendering (inline code, code blocks, lists, emphasis)
- Single route: `/` → `Home` → `AuthWrapper` (no router-level protected routes)

#### Key Components

1. **Authentication Flow**
   - `AuthWrapper`: Login/register gate; renders `SuccessPage` when logged in
   - `AuthLayout`: Shared branded layout for login/register with feature highlights and GitHub link
   - `LoginPage` / `RegisterPage`: User authentication forms

2. **Interview Experience** (four tabs in `InterviewTraining`)
   - **Interview Chat** (`InterviewChat`): Real-time interview simulation with SSE streaming, markdown rendering, follow-up conversations, session recovery, and speech-to-text input
   - **Resume Drill** (`ResumeDrill` + `resume-drill/` subcomponents): Project selection sidebar, chat panel, resume preview modal
   - **History** (`InterviewHistory`): Past performance review
   - **Progress Trend** (`ProgressChart`): Visual performance tracking with position-based breakdown

3. **Shared UI**
   - `InterviewRecordDetailsModal`: Detailed answer analysis
   - `NewsQuestionCard`: Display trending questions from news
   - `NewsQuestionPush`: In-app notification for daily challenges
   - `CustomAlert`, `Layout`: Reusable UI primitives

#### Hooks

| Hook | Purpose |
|---|---|
| `useDebounce` | Debounced values (API key input validation) |
| `useSpeechRecognition` | Web Speech API voice input for answer fields |

#### Key Frontend Patterns

- **`sessionIdRef` pattern**: Uses `useRef` to track the latest `sessionId` across closures, avoiding stale closure issues in `useCallback`-based generation functions
- **`isRecoveredSession` flag**: Prevents auto-generation of new questions when restoring a session from the server
- **Placeholder message pattern**: Creates `temp-question-{timestamp}` messages for streaming, replaces with real `question_id` on `final` event
- **API key validation**: Blocks interview start with inline error when OpenAI API key is missing
- **Encrypted API key storage**: OpenAI API key encrypted with AES-GCM (PBKDF2 key derivation) via Web Crypto API in `crypto.ts`; stored in Zustand/localStorage, never sent to backend for storage
- **Legacy plaintext detection**: Keys starting with `sk-` are treated as unencrypted legacy values

#### Push Notification System

**Service Architecture** (`newsQuestionPushService.ts`):
- **Daily Push Logic**: 24-hour intervals for new questions
- **Smart Filtering**: Avoids duplicate questions and respects user context
- **Browser Integration**: Native Notification API usage
- **Session Awareness**: Pauses during active interviews
- **Persistence**: Uses `useNewsQuestionPushStore` (Zustand) for push history and last push times per user

**User Experience Flow**:
1. User opts into daily notifications
2. Service fetches trending questions based on user preferences
3. Browser notification displays with news context
4. In-app reminder system for unanswered questions

### API Interaction Patterns

#### Authentication
- Simple username/password authentication
- Password hashing using SHA-256
- Session management via Zustand (client-side)
- No JWT tokens (simplified for demo purposes)

#### Data Flow Patterns

1. **Streaming Question Generation Flow**:
   ```
   User Request → DB INSERT (status=generating) → Background Thread (OpenAI stream)
     → Shared State (deltas) → SSE Generator (yields to client)
     → Background Flush Task (periodic DB updates)
     → Final: status=completed, full content persisted
   ```

2. **Follow-up Conversation Flow**:
   ```
   Initial Question → User Answer → Follow-up Generation (with conversation history)
     → User Answer → ... (repeat until follow-up limit)
     → Multi-turn Evaluation → Comprehensive Scoring
   ```

3. **Answer Evaluation Flow**:
   ```
   User Answer → Question Context → AI Evaluation (json_schema structured output)
     → AnswerEvaluation persisted → InterviewRecord saved via /api/users/{id}/interview-records
     → Fallback: evaluate_answer_mock() on AI failure (keyword/length heuristic)
   ```

4. **Session Recovery Flow**:
   ```
   Page Load → Detect sessionId in localStorage → GET /sessions/{id}
     → If active: GET /questions/recover → Restore messages → Resume interview
     → If completed/missing: Clear sessionId → Show start screen
   ```

5. **News-Based Questions Flow**:
   ```
   Scheduled Task (4h) OR POST /fetch-news → RSS/API Fetch → News Processing
     → AI Question Generation (AsyncOpenAI, parallel) → Relevance Scoring (≥0.4)
     → Database Storage → GET /trending-questions
   ```

6. **Resume Drill Flow**:
   ```
   Upload Resume → AI Project Extraction → Select Project → Start Session (resume_drill)
     → SSE Resume Question → Answer → Follow-ups → Evaluate → Save Record
     → Draft persisted in localStorage for crash recovery
   ```

#### Caching and State Management Strategy

**`useAuthStore`** (Zustand, persisted to localStorage):
- Authentication state (username, user_id)
- Interview session ID (survives page refresh)
- Selected position and difficulty
- OpenAI API key (AES-GCM encrypted)
- Model preference (`gpt-5.4-mini` default), language (en/zh/ja/ko), creativity level
- Question count target, follow-up limit
- Daily question count and date

**`useNewsQuestionPushStore`** (Zustand, persisted):
- Push history and last push times per user

### AI Integration

#### OpenAI Responses API Integration

| Use Case | Client | Method | Notes |
|---|---|---|---|
| Stream question gen | Sync `OpenAI` | `client.responses.stream()` | Background thread; events: `response.output_text.delta` |
| Non-stream question gen | Sync `OpenAI` | `client.responses.create()` | Fallback endpoint |
| Answer evaluation | Sync `OpenAI` | `responses.create()` + `text: { format: json_schema }` | Strict schema for score/feedback/metrics |
| Follow-up evaluation | Sync `OpenAI` | Same structured output | Full conversation context |
| News question gen | `AsyncOpenAI` | `responses.create()` | Parallel via `asyncio.gather` |
| Resume project extraction | Sync `OpenAI` | `responses.create()` + json_schema | Retries + heuristic fallback |

- **Default Model**: `gpt-5.4-mini` (configurable per-request via frontend; also supports `gpt-4.1-nano`, `gpt-4o`, etc.)
- **Per-request API key**: Frontend sends `openai_api_key` on each AI call; backend falls back to `OPENAI_API_KEY` env var
- **Creativity sampling** (`questions.py`): `focused` (temp 0.3), `balanced` (0.75), `creative` (1.1)
- **Multilingual**: `language` param (en/zh/ja/ko) appended to system and user prompts
- **`response_id`**: Captured in stream final events for future follow-up chaining

#### Evaluation Metrics
- **Technical Accuracy** (40%): Correctness of technical content
- **Communication Clarity** (30%): Explanation quality and structure
- **Completeness** (20%): Coverage of expected topics
- **Practical Experience** (10%): Real-world application insights

#### Mock Evaluation Fallback
When OpenAI calls fail, `evaluate_answer_mock()` provides a keyword/length-based heuristic score so the user experience is not blocked.

### Performance and Scalability Considerations

#### Database Optimization
- Async SQLAlchemy for non-blocking operations
- Proper indexing on frequently queried fields
- Relationship optimization with eager loading where needed
- Incremental writes during streaming (sentence-boundary + time-based flushing)

#### Background Processing
- **OpenAI streaming**: Decoupled from SSE connection via background threads
- **DB flushing**: Independent async tasks that survive client disconnects
- **News processing**: Async task execution with APScheduler; parallel AI generation via `asyncio.gather`
- **News cleanup**: Periodic deletion + SQLite `VACUUM` to reclaim space
- Separation of concerns between HTTP requests, background generation, and scheduled tasks

#### Resilience
- Server-side generation continues after client disconnect
- Startup cleanup marks stale `generating` questions as `interrupted`
- Frontend graceful fallback from streaming to non-streaming API on error
- Session recovery from server state on page refresh
- Resume drill draft recovery from localStorage
- AI evaluation fallback when OpenAI is unavailable

### Security Considerations

#### Current Implementation
- Basic password hashing (SHA-256)
- CORS configuration for frontend access
- Input validation via Pydantic schemas
- SQL injection prevention through ORM usage
- OpenAI API key passed per-request (never stored server-side)
- Client-side AES-GCM encryption for API key in localStorage (PBKDF2-derived key)
- Resume upload size limit (5 MB) and extension whitelist (PDF/TXT/MD)

### Environment Variables

#### Backend (`backend/.env`)
| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | `""` | Server-side AI fallback |
| `NEWS_FETCH_USER_AGENT` | Chrome UA string | RSS/API fetch headers |
| `NEWS_RETENTION_DAYS` | `30` | News cleanup retention period |
| `DATABASE_URL` | `sqlite+aiosqlite:///./database/mockmate.db` | DB connection |
| `DATABASE_ECHO` | `true` | SQL query logging |
| `HOST_IP` | `0.0.0.0` | Server bind address |
| `SERVICE_PORT` | `5200` | Server port |

#### Frontend (`frontend/.env`)
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5200` | Backend API URL |
