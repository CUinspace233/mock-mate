from pydantic import BaseModel, EmailStr
from datetime import datetime
from enum import Enum
from typing import Any


# Enums for validation
class Position(str, Enum):
    FRONTEND = "frontend"
    BACKEND = "backend"
    FULLSTACK = "fullstack"
    MOBILE = "mobile"
    DEVOPS = "devops"


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"


class SessionType(str, Enum):
    PRACTICE = "practice"
    MOCK_INTERVIEW = "mock_interview"


class QuestionType(str, Enum):
    OPINION = "opinion"
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"


# User
class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserLoginResponse(BaseModel):
    user: UserOut
    message: str


# Question
class QuestionBase(BaseModel):
    content: str
    position: Position
    difficulty: Difficulty | None = Difficulty.MEDIUM
    question_type: QuestionType | None = QuestionType.TECHNICAL
    expected_keywords: list[str] = []


class QuestionCreate(QuestionBase):
    pass


class QuestionOut(QuestionBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class GenerateQuestionRequest(BaseModel):
    position: Position
    difficulty: Difficulty | None = Difficulty.MEDIUM
    question_type: QuestionType | None = QuestionType.TECHNICAL
    user_id: int


class GenerateQuestionResponse(BaseModel):
    question_id: str
    content: str
    position: str
    difficulty: str
    question_type: QuestionType | None = QuestionType.TECHNICAL
    expected_keywords: list[str]
    created_at: datetime


class GeneratedQuestion(BaseModel):
    content: str
    question_type: QuestionType
    position: str
    difficulty: str
    expected_keywords: list[str]


# Answer Evaluation
class EvaluateAnswerRequest(BaseModel):
    question_id: str
    user_id: int
    answer: str
    session_id: str | None = None


class EvaluationDetails(BaseModel):
    technical_accuracy: float
    communication_clarity: float
    completeness: float
    practical_experience: float


class AnswerEvaluationResult(BaseModel):
    score: int
    feedback: str
    strengths: list[str]
    improvements: list[str]
    keywords_covered: list[str]
    keywords_missed: list[str]
    evaluation_details: EvaluationDetails


class EvaluateAnswerResponse(BaseModel):
    evaluation_id: str
    score: int
    feedback: str
    strengths: list[str]
    improvements: list[str]
    keywords_covered: list[str]
    keywords_missed: list[str]
    evaluation_details: EvaluationDetails
    created_at: datetime


# Interview Session
class StartSessionRequest(BaseModel):
    user_id: int
    position: Position
    session_type: SessionType | None = SessionType.PRACTICE


class StartSessionResponse(BaseModel):
    session_id: str
    user_id: int
    position: str
    status: str
    started_at: datetime


class CompleteSessionRequest(BaseModel):
    user_id: int


class SessionSummary(BaseModel):
    total_questions: int
    average_score: float
    total_duration: int  # in minutes
    strengths: list[str]
    areas_for_improvement: list[str]


class CompleteSessionResponse(BaseModel):
    session_id: str
    status: str
    completed_at: datetime
    summary: SessionSummary


class SessionDetailResponse(BaseModel):
    session_id: str
    user_id: int
    position: str
    status: str
    session_type: SessionType
    started_at: datetime
    completed_at: datetime | None = None
    records_count: int


# Interview Record schemas
class InterviewRecordBase(BaseModel):
    question_content: str
    answer: str
    score: int
    feedback: str
    position: Position


class InterviewRecordCreate(InterviewRecordBase):
    session_id: str | None = None
    question_id: str
    user_id: int
    evaluation_details: dict[str, Any] = {}


class InterviewRecordOut(InterviewRecordBase):
    id: str
    session_id: str | None = None
    question_id: str
    user_id: int
    evaluation_details: dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True


class InterviewRecordSaveResponse(BaseModel):
    record_id: str
    message: str


class GetInterviewRecordsResponse(BaseModel):
    records: list[InterviewRecordOut]
    total_count: int
    pagination: dict[str, Any]


# Progress Analytics
class ProgressData(BaseModel):
    date: str
    score: float
    question_count: int


class ProgressStatistics(BaseModel):
    total_questions: int
    average_score: float
    improvement_rate: float
    best_score: int
    worst_score: int
    current_streak: int
    total_practice_time: int


class PositionBreakdown(BaseModel):
    position: str
    question_count: int
    average_score: float


class GetProgressResponse(BaseModel):
    progress_data: list[ProgressData]
    statistics: ProgressStatistics
    position_breakdown: list[PositionBreakdown]


# User Preferences
class NotificationSettings(BaseModel):
    daily_reminder: bool = True
    progress_updates: bool = True
    achievement_alerts: bool = True


class UserPreferencesBase(BaseModel):
    preferred_position: Position | None = Position.FRONTEND
    difficulty_level: Difficulty | None = Difficulty.MEDIUM
    daily_question_goal: int | None = 5
    notification_settings: NotificationSettings | None = NotificationSettings()


class UserPreferencesCreate(UserPreferencesBase):
    user_id: int


class UserPreferencesUpdate(UserPreferencesBase):
    pass


class UserPreferencesOut(UserPreferencesBase):
    user_id: int
    updated_at: datetime

    class Config:
        from_attributes = True


# Question Categories
class QuestionCategory(BaseModel):
    value: str
    label: str
    question_count: int


class TopicCount(BaseModel):
    position: str
    question_type: str
    count: int


class QuestionCategoriesResponse(BaseModel):
    positions: list[QuestionCategory]
    question_types: list[TopicCount]


# Legacy schemas for backward compatibility
class InterviewCreate(BaseModel):
    question: str
    answer: str
    feedback: str


class InterviewOut(InterviewCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# News and Trending Topics
class NewsSourceType(str, Enum):
    RSS = "rss"
    API = "api"
    WEB_SCRAPING = "web_scraping"


class NewsCategory(str, Enum):
    AI = "ai"
    WEB_DEV = "web_dev"
    MOBILE = "mobile"
    DEVOPS = "devops"
    GENERAL_TECH = "general_tech"


class NewsSourceBase(BaseModel):
    name: str
    source_type: NewsSourceType
    url: str
    category: NewsCategory
    is_active: bool = True


class NewsSourceOut(NewsSourceBase):
    id: str
    last_fetched: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class NewsItemBase(BaseModel):
    title: str
    summary: str | None = None
    content: str | None = None
    url: str
    published_at: datetime
    category: NewsCategory


class NewsItemOut(NewsItemBase):
    id: str
    source_id: str
    is_processed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NewsBasedQuestionOut(BaseModel):
    id: str
    news_item_id: str
    question_id: str
    relevance_score: float
    question_type: QuestionType
    ai_reasoning: str | None = None
    created_at: datetime

    # Nested question and news item data
    question: QuestionOut
    news_item: NewsItemOut

    class Config:
        from_attributes = True


class TrendingQuestionResponse(BaseModel):
    """Response for trending/news-based questions"""

    id: str
    content: str
    position: str
    difficulty: str
    question_type: QuestionType
    source_title: str
    source_url: str
    published_at: datetime
    relevance_score: float
    ai_reasoning: str | None = None
    created_at: datetime


class FetchNewsRequest(BaseModel):
    category: NewsCategory | None = None
    limit: int = 10


class FetchNewsResponse(BaseModel):
    news_items: list[NewsItemOut]
    questions_generated: int
    message: str


class GetTrendingQuestionsRequest(BaseModel):
    position: Position | None = None
    category: NewsCategory | None = None
    limit: int = 5
    days_back: int = 7  # How many days back to look for news


class GetTrendingQuestionsResponse(BaseModel):
    questions: list[TrendingQuestionResponse]
    total_count: int
