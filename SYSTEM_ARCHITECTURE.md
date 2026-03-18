# MockMate - Interview Simulation System Architecture

## Overview

MockMate is a comprehensive interview practice platform that simulates real-world technical interviews. The system combines AI-powered question generation with incremental streaming persistence, automated answer evaluation, multi-turn follow-up conversations, and trending news-based interview questions to provide an up-to-date and realistic interview experience.

## System Architecture

### Backend (Python FastAPI)

#### Core Components

1. **FastAPI Application** (`main.py`)
   - CORS enabled
   - Lifecycle management for database initialization and scheduler startup
   - Startup migration: ALTER TABLE for schema evolution on existing SQLite databases
   - Stale question cleanup: marks any `status="generating"` questions as `"interrupted"` on startup (crash recovery)
   - Modular router-based architecture

2. **Database Layer**
   - **SQLAlchemy ORM** with async support
   - **SQLite database** (`mockmate.db`) for data persistence
   - Comprehensive schema with proper relationships
   - No migration system — uses `Base.metadata.create_all()` with manual ALTER TABLE for new columns

#### Key Data Models

1. **User Management**
   - `User`: Core user information with authentication
   - `UserPreferences`: Personalized settings (position, difficulty, question type)

2. **Interview System**
   - `InterviewSession`: Tracks interview sessions with status and timing
   - `InterviewRecord`: Individual question-answer pairs with evaluation
   - `Question`: Core question repository with metadata, `status` field (`generating`/`completed`/`interrupted`/`discarded`), and `session_id` FK linking to `InterviewSession`
   - `AnswerEvaluation`: Detailed answer assessment results

3. **News Integration**
   - `NewsSource`: RSS feeds and API endpoints configuration
   - `NewsItem`: Individual news articles with processing status
   - `NewsBasedQuestion`: AI-generated questions from current events

#### API Endpoints Structure

**User Management** (`/api/users`)
- User registration and authentication (simple hash-based)
- Profile management and preferences
- Interview history and progress tracking
- Performance analytics with position-based breakdown

**Questions** (`/api/questions`)
- AI-powered question generation using OpenAI Responses API (configurable model, default `gpt-4.1-nano`)
- Streaming generation via SSE with background persistence (`/generate/stream`)
- Follow-up question generation based on conversation history (`/generate/followup/stream`)
- Non-streaming fallback generation (`/generate`)
- Question categorization by position and difficulty
- Question recovery for interrupted sessions (`/recover`)
- Question discard for abandoned generations (`/{question_id}/discard`)

**Answers** (`/api/answers`)
- AI-powered answer evaluation using OpenAI Responses API with structured JSON output
- Single-turn evaluation (`/evaluate`) and multi-turn follow-up evaluation (`/evaluate/followup`)
- Comprehensive scoring (technical accuracy, clarity, completeness, practical experience)
- Detailed feedback with strengths and improvement areas
- Keyword coverage analysis

**Sessions** (`/api/sessions`)
- Interview session lifecycle management (start → active → completed)
- Session completion with summary generation
- Session detail retrieval for recovery
- Performance tracking across sessions

**Trending Questions** (`/api/trending`)
- News fetching from multiple RSS sources (Google News, Hacker News)
- AI-powered question generation from current events
- Relevance scoring and question type classification
- Category-based news processing (AI, Web Dev, Mobile, DevOps)

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

1. **`_GenerationState`**: Thread-safe shared state (deltas list, accumulated content, done/error flags, response_id) protected by `threading.Lock`
2. **`_run_openai_stream_in_thread()`**: Runs the synchronous `client.responses.stream()` in a daemon thread; writes deltas into shared state
3. **`_bg_flush_task()`**: `asyncio.create_task` that periodically flushes content to DB via its own `AsyncSessionLocal` session. **Survives SSE client disconnect.** Flush triggers on sentence boundaries (`.?!。？！`) or time-based floor (≥1s)
4. **SSE Generator** (`sse_iter()`): Polls shared state every 50ms, yields deltas as SSE events. Cancellation-safe — if the client disconnects, the thread and flush task continue independently

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
  → [server restart]   → startup cleanup marks as interrupted
```

### Session Recovery

When a user refreshes or returns to the page:

1. **Frontend** detects `sessionId` in Zustand (persisted to localStorage) but `interviewStarted=false`
2. Calls `GET /api/sessions/{sessionId}` to check if session is still `active`
3. If active: calls `GET /api/questions/recover?session_id=xxx&include_completed=true` to fetch all questions
4. Restores messages from completed questions, sets `isRecoveredSession=true` to skip auto-generation
5. If session completed or not found: clears stale `sessionId`

### Follow-up Conversation System

After answering a question, the system can generate follow-up questions that probe deeper:

1. **Conversation history** is tracked client-side as `ConversationEntry[]` (role: interviewer/candidate)
2. Follow-ups are generated via `/generate/followup/stream` with full conversation context
3. Each follow-up is a separate `Question` record linked to the same session
4. After reaching the follow-up limit, a comprehensive multi-turn evaluation is performed via `/evaluate/followup`

### Scheduled Tasks Logic

#### News Processing Scheduler (`scheduler.py`)

**Architecture:**
- Uses `AsyncIOScheduler` from APScheduler
- Runs as background service during application lifecycle
- Direct database access (bypasses HTTP layer for efficiency)

**Execution Flow:**
1. **Trigger**: Every 4 hours automatically
2. **News Fetching**:
   - Fetches from predefined RSS sources by category
   - Handles multiple source types (RSS feeds, APIs)
   - Parses content with proper error handling
3. **AI Processing**:
   - Generates interview questions from news items
   - Calculates relevance scores for each question
   - Stores processed questions for later retrieval
4. **Database Updates**:
   - Saves news items with processing status
   - Links generated questions to source articles
   - Updates source fetch timestamps

**News Sources Configuration:**
- **AI Category**: Google News AI feeds, Hacker News API
- **Web Development**: Google News with web tech keywords
- **Mobile Development**: React Native, Flutter focused feeds
- **DevOps**: Docker, Kubernetes, cloud infrastructure news

### Frontend (React + TypeScript + Joy UI)

#### Architecture
- **React 19** with TypeScript for type safety
- **Vite** for build tooling and development
- **Zustand** for client-side state management and persistence
- **Joy UI** for UI components
- **react-markdown** for AI message rendering (inline code, code blocks, lists, emphasis)

#### Key Components

1. **Authentication Flow**
   - `AuthLayout`: Shared branded layout for login/register with feature highlights and GitHub link
   - `LoginPage` / `RegisterPage`: User authentication forms
   - Session management via Zustand

2. **Interview Experience**
   - `InterviewChat`: Real-time interview simulation with SSE streaming, markdown rendering, follow-up conversations, and session recovery
   - `InterviewTraining`: Practice mode orchestrator — manages session lifecycle, recovery on page load, position/difficulty selection, API key validation
   - `InterviewHistory`: Past performance review and analytics

3. **News Integration**
   - `NewsQuestionCard`: Display trending questions from news
   - `NewsQuestionPush`: Notification system for daily challenges
   - Push service with browser notifications

4. **Analytics and Progress**
   - `ProgressChart`: Visual performance tracking
   - `InterviewRecordDetailsModal`: Detailed answer analysis
   - Position-based progress breakdown

#### Key Frontend Patterns

- **`sessionIdRef` pattern**: Uses `useRef` to track the latest `sessionId` across closures, avoiding stale closure issues in `useCallback`-based generation functions
- **`isRecoveredSession` flag**: Prevents auto-generation of new questions when restoring a session from the server
- **Placeholder message pattern**: Creates `temp-question-{timestamp}` messages for streaming, replaces with real `question_id` on `final` event
- **API key validation**: Blocks interview start with inline error when OpenAI API key is missing

#### Push Notification System

**Service Architecture** (`newsQuestionPushService.ts`):
- **Daily Push Logic**: 24-hour intervals for new questions
- **Smart Filtering**: Avoids duplicate questions and respects user context
- **Browser Integration**: Native notification API usage
- **Session Awareness**: Pauses during active interviews
- **Persistence**: Uses Zustand for push history, session state, and user preferences

**User Experience Flow**:
1. User opts into daily notifications
2. Service fetches trending questions based on user preferences (from Zustand store)
3. Browser notification displays with news context
4. In-app reminder system for unanswered questions
5. Progress tracking for engagement metrics (all state managed by Zustand)

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
   User Answer → Question Context → AI Evaluation →
   Detailed Scoring → Feedback Generation → Storage → Response
   ```

4. **Session Recovery Flow**:
   ```
   Page Load → Detect sessionId in localStorage → GET /sessions/{id}
     → If active: GET /questions/recover → Restore messages → Resume interview
     → If completed/missing: Clear sessionId → Show start screen
   ```

5. **News-Based Questions Flow**:
   ```
   Scheduled Task → RSS Fetch → News Processing →
   AI Question Generation → Database Storage → API Retrieval
   ```

#### Caching and State Management Strategy
- **Zustand** is used for all client-side state persistence, including:
  - Authentication state
  - Interview session ID (survives page refresh)
  - Push notification history
  - Daily question count
  - User selected position
  - OpenAI API key (encrypted)
  - Question count target, follow-up limit, language, model preferences

### AI Integration

#### OpenAI Responses API Integration
- **Default Model**: `gpt-4.1-nano` (configurable per-request via frontend)
- **API**: OpenAI Responses API (`client.responses.create` / `client.responses.stream`)
- **Question Generation**: Context-aware prompts with position, difficulty, and language
- **Follow-up Generation**: Conversation-history-aware prompts for multi-turn interviews
- **Answer Evaluation**: Structured JSON output via `text` parameter with `json_schema` format
- **News Processing**: Content analysis and question relevance scoring (uses `AsyncOpenAI`)

#### Evaluation Metrics
- **Technical Accuracy** (40%): Correctness of technical content
- **Communication Clarity** (30%): Explanation quality and structure
- **Completeness** (20%): Coverage of expected topics
- **Practical Experience** (10%): Real-world application insights

### Performance and Scalability Considerations

#### Database Optimization
- Async SQLAlchemy for non-blocking operations
- Proper indexing on frequently queried fields
- Relationship optimization with eager loading
- Incremental writes during streaming (sentence-boundary + time-based flushing)

#### Background Processing
- **OpenAI streaming**: Decoupled from SSE connection via background threads
- **DB flushing**: Independent async tasks that survive client disconnects
- **News processing**: Async task execution with APScheduler
- Separation of concerns between HTTP requests, background generation, and scheduled tasks

#### Resilience
- Server-side generation continues after client disconnect
- Startup cleanup marks stale `generating` questions as `interrupted`
- Frontend graceful fallback from streaming to non-streaming API on error
- Session recovery from server state on page refresh

### Security Considerations

#### Current Implementation
- Basic password hashing (SHA-256)
- CORS configuration for frontend access
- Input validation via Pydantic schemas
- SQL injection prevention through ORM usage
- OpenAI API key passed per-request (never stored server-side), encrypted in client localStorage
