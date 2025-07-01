# Mock Mate - Interview Simulation System Architecture

## Overview

Mock Mate is a comprehensive interview practice platform that simulates real-world technical interviews. The system combines AI-powered question generation, automated answer evaluation, and trending news-based interview questions to provide an up-to-date and realistic interview experience.

## System Architecture

### Backend (Python FastAPI)

#### Core Components

1. **FastAPI Application** (`main.py`)
   - CORS enabled
   - Lifecycle management for database initialization and scheduler startup
   - Modular router-based architecture

2. **Database Layer**
   - **SQLAlchemy ORM** with async support
   - **SQLite database** (`mockmate.db`) for data persistence
   - Comprehensive schema with proper relationships

#### Key Data Models

1. **User Management**
   - `User`: Core user information with authentication
   - `UserPreferences`: Personalized settings (position, difficulty, question type)

2. **Interview System**
   - `InterviewSession`: Tracks interview sessions with status and timing
   - `InterviewRecord`: Individual question-answer pairs with evaluation
   - `Question`: Core question repository with metadata
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
- AI-powered question generation using OpenAI GPT-4o-mini
- Question categorization by position and difficulty
- Question-type-based question filtering (Technical, Behavioral, Opinion)
- Integration with news-based questions

**Answers** (`/api/answers`)
- AI-powered answer evaluation using OpenAI GPT-4o-mini
- Comprehensive scoring (technical accuracy, clarity, completeness)
- Detailed feedback with strengths and improvement areas
- Keyword coverage analysis
- Fallback to mock evaluation if AI fails

**Sessions** (`/api/sessions`)
- Interview session lifecycle management
- Session completion with summary generation
- Performance tracking across sessions
- Session-based answer organization

**Trending Questions** (`/api/trending`)
- News fetching from multiple RSS sources (Google News, Hacker News)
- AI-powered question generation from current events
- Relevance scoring and question type classification
- Category-based news processing (AI, Web Dev, Mobile, DevOps)

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

#### Key Components

1. **Authentication Flow**
   - `AuthWrapper`: Main authentication container
   - `LoginPage` / `RegisterPage`: User authentication forms
   - Session management via Zustand

2. **Interview Experience**
   - `InterviewChat`: Real-time interview simulation interface
   - `InterviewTraining`: Practice mode with immediate feedback
   - `InterviewHistory`: Past performance review and analytics

3. **News Integration**
   - `NewsQuestionCard`: Display trending questions from news
   - `NewsQuestionPush`: Notification system for daily challenges
   - Push service with browser notifications

4. **Analytics and Progress**
   - `ProgressChart`: Visual performance tracking
   - `InterviewRecordDetailsModal`: Detailed answer analysis
   - Position-based progress breakdown

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

1. **Question Generation Flow**:
   ```
   User Request → Position/Difficulty/Question Type Selection → AI API Call → 
   Question Storage → Response to Frontend
   ```

2. **Answer Evaluation Flow**:
   ```
   User Answer → Question Context → AI Evaluation → 
   Detailed Scoring → Feedback Generation → Storage → Response
   ```

3. **News-Based Questions Flow**:
   ```
   Scheduled Task → RSS Fetch → News Processing → 
   AI Question Generation → Database Storage → API Retrieval
   ```

#### Caching and State Management Strategy
- **Zustand** is used for all client-side state persistence, including:
  - Authentication state
  - Interview session state
  - Push notification history
  - Daily question count
  - User selected position

### AI Integration

#### OpenAI GPT Integration
- **Model**: GPT-4o-mini for cost efficiency
- **Question Generation**: Context-aware prompts with position and difficulty
- **Answer Evaluation**: Structured JSON responses with detailed metrics
- **News Processing**: Content analysis and question relevance scoring

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

#### Caching Strategy
- In-memory question caching for repeated requests
- News processing results cached for 24 hours

#### Background Processing
- Async task execution for news processing
- Separation of concerns between HTTP requests and scheduled tasks
- Resource-efficient RSS parsing with request limits

### Security Considerations

#### Current Implementation
- Basic password hashing (SHA-256)
- CORS configuration for frontend access
- Input validation via Pydantic schemas
- SQL injection prevention through ORM usage
