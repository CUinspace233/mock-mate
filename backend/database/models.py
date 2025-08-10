from sqlalchemy import Integer, String, Boolean, ForeignKey, Text, JSON, DateTime
from sqlalchemy.orm import relationship, Mapped, mapped_column, DeclarativeBase
from datetime import datetime, UTC
import uuid


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(UTC))

    # Relationships
    interview_records: Mapped[list["InterviewRecord"]] = relationship(
        "InterviewRecord", back_populates="user"
    )
    interview_sessions: Mapped[list["InterviewSession"]] = relationship(
        "InterviewSession", back_populates="user"
    )
    preferences: Mapped["UserPreferences | None"] = relationship(
        "UserPreferences", back_populates="user", uselist=False
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # frontend, backend, fullstack, etc.
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")  # easy, medium, hard
    question_type: Mapped[str] = mapped_column(
        String(20), default="technical"
    )  # opinion, technical, behavioral
    expected_keywords: Mapped[list[str]] = mapped_column(JSON)  # list of expected keywords
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(UTC))

    # Relationships
    interview_records: Mapped[list["InterviewRecord"]] = relationship(
        "InterviewRecord", back_populates="question"
    )


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    position: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, completed
    session_type: Mapped[str] = mapped_column(
        String(20), default="practice"
    )  # practice, mock_interview
    started_at: Mapped[datetime] = mapped_column(default=datetime.now(UTC))
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="interview_sessions")
    interview_records: Mapped[list["InterviewRecord"]] = relationship(
        "InterviewRecord", back_populates="session"
    )


class InterviewRecord(Base):
    __tablename__ = "interview_records"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String, ForeignKey("interview_sessions.id"))
    question_id: Mapped[str] = mapped_column(String, ForeignKey("questions.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    question_content: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-100
    feedback: Mapped[str] = mapped_column(Text)
    position: Mapped[str] = mapped_column(String(50), nullable=False)
    evaluation_details: Mapped[dict] = mapped_column(JSON)  # Detailed evaluation metrics
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(UTC))

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="interview_records")
    question: Mapped["Question"] = relationship("Question", back_populates="interview_records")
    session: Mapped["InterviewSession"] = relationship(
        "InterviewSession", back_populates="interview_records"
    )


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), primary_key=True)
    preferred_position: Mapped[str] = mapped_column(String(50), default="frontend")
    difficulty_level: Mapped[str] = mapped_column(String(20), default="medium")
    daily_question_goal: Mapped[int] = mapped_column(Integer, default=5)
    notification_settings: Mapped[dict] = mapped_column(JSON, default=lambda: {})
    updated_at: Mapped[datetime] = mapped_column(default=datetime.now(UTC))

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="preferences")


class AnswerEvaluation(Base):
    __tablename__ = "answer_evaluations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id: Mapped[str] = mapped_column(String, ForeignKey("questions.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-100
    feedback: Mapped[str] = mapped_column(Text)
    strengths: Mapped[list[str]] = mapped_column(JSON)  # list of strengths
    improvements: Mapped[list[str]] = mapped_column(JSON)  # list of improvements
    keywords_covered: Mapped[list[str]] = mapped_column(JSON)  # list of keywords covered
    keywords_missed: Mapped[list[str]] = mapped_column(JSON)  # list of keywords missed
    evaluation_details: Mapped[dict] = mapped_column(JSON)  # Detailed scoring breakdown
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(UTC))


class NewsSource(Base):
    """Store news sources and their configuration"""

    __tablename__ = "news_sources"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "Google News - AI", "Hacker News" etc.
    source_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "rss", "api", "web_scraping"
    url: Mapped[str] = mapped_column(String(500), nullable=False)  # RSS feed URL or API endpoint
    category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "AI", "web_dev", "mobile", etc.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_fetched: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    news_items: Mapped[list["NewsItem"]] = relationship("NewsItem", back_populates="source")


class NewsItem(Base):
    """Store individual news items fetched from sources"""

    __tablename__ = "news_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    source_id: Mapped[str] = mapped_column(String, ForeignKey("news_sources.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=True)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    published_at: Mapped[datetime] = mapped_column(nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    is_processed: Mapped[bool] = mapped_column(
        Boolean, default=False
    )  # Whether AI has analyzed this
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(UTC))

    # Relationships
    source: Mapped["NewsSource"] = relationship("NewsSource", back_populates="news_items")
    generated_questions: Mapped[list["NewsBasedQuestion"]] = relationship(
        "NewsBasedQuestion", back_populates="news_item"
    )


class NewsBasedQuestion(Base):
    """Questions generated from news items"""

    __tablename__ = "news_based_questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    news_item_id: Mapped[str] = mapped_column(String, ForeignKey("news_items.id"), nullable=False)
    question_id: Mapped[str] = mapped_column(String, ForeignKey("questions.id"), nullable=False)
    relevance_score: Mapped[float] = mapped_column(nullable=False)  # 0.0 to 1.0
    question_type: Mapped[str] = mapped_column(
        String(50), default="opinion"
    )  # "opinion", "technical", "behavioral"
    ai_reasoning: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(UTC))

    # Relationships
    news_item: Mapped["NewsItem"] = relationship("NewsItem", back_populates="generated_questions")
    question: Mapped["Question"] = relationship("Question")
