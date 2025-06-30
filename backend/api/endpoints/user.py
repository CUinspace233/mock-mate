import hashlib
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from database import models
from api.deps import get_db
from datetime import datetime, timedelta, UTC
from database.schemas import (
    InterviewRecordCreate,
    InterviewRecordSaveResponse,
    UserCreate,
    UserOut,
    UserLogin,
    UserLoginResponse,
    GetInterviewRecordsResponse,
    GetProgressResponse,
    UserPreferencesOut,
    UserPreferencesUpdate,
    InterviewRecordOut,
    ProgressData,
    ProgressStatistics,
    PositionBreakdown,
)

router = APIRouter()


def hash_password(password: str) -> str:
    """Simple password hashing using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return hash_password(plain_password) == hashed_password


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user"""

    # Check if username already exists
    stmt = select(models.User).where(models.User.username == user_data.username)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered"
        )

    # Check if email already exists
    stmt = select(models.User).where(models.User.email == user_data.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create new user
    hashed_password = hash_password(user_data.password)
    new_user = models.User(
        username=user_data.username, email=user_data.email, hashed_password=hashed_password
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Create default preferences
    preferences = models.UserPreferences(user_id=new_user.id)
    db.add(preferences)
    await db.commit()

    return new_user


@router.post("/login", response_model=UserLoginResponse)
async def login_user(login_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """User login"""
    stmt = select(models.User).where(models.User.username == login_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password"
        )

    if not verify_password(login_data.password, user.hashed_password or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password"
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    return {"user": user, "message": "Login successful"}


@router.get("/", response_model=list[UserOut])
async def get_all_users(db: AsyncSession = Depends(get_db)):
    """Get all users (for admin purposes)"""
    stmt = select(models.User)
    result = await db.execute(stmt)
    users = result.scalars().all()
    return users


@router.get("/{user_id}", response_model=UserOut)
async def get_user_by_id(user_id: int, db: AsyncSession = Depends(get_db)):
    """Get user by ID"""
    stmt = select(models.User).where(models.User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return user


# Interview Records Management


@router.get("/{user_id}/interview-records", response_model=GetInterviewRecordsResponse)
async def get_interview_records(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    position: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    """Get user's interview history"""

    user_stmt = select(models.User).where(models.User.id == user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    query = select(models.InterviewRecord).where(models.InterviewRecord.user_id == user_id)

    # Apply filters
    if position:
        query = query.where(models.InterviewRecord.position == position)

    if date_from:
        try:
            date_from_dt = datetime.fromisoformat(date_from)
            query = query.where(models.InterviewRecord.created_at >= date_from_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date_from format"
            )

    if date_to:
        try:
            date_to_dt = datetime.fromisoformat(date_to)
            query = query.where(models.InterviewRecord.created_at <= date_to_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date_to format"
            )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total_count = count_result.scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(desc(models.InterviewRecord.created_at)).offset(offset).limit(limit)

    result = await db.execute(query)
    records = result.scalars().all()

    return GetInterviewRecordsResponse(
        records=[InterviewRecordOut.model_validate(record) for record in records],
        total_count=total_count,
        pagination={"limit": limit, "offset": offset, "has_more": offset + limit < total_count},
    )


@router.post("/{user_id}/interview-records", response_model=InterviewRecordSaveResponse)
async def save_interview_record(
    user_id: int, record_data: InterviewRecordCreate, db: AsyncSession = Depends(get_db)
):
    """Save an interview record"""

    user_stmt = select(models.User).where(models.User.id == user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user_id != record_data.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User ID mismatch")

    record = models.InterviewRecord(
        created_at=datetime.now(UTC),
        session_id=record_data.session_id,
        question_id=record_data.question_id,
        user_id=user_id,
        question_content=record_data.question_content,
        answer=record_data.answer,
        score=record_data.score,
        feedback=record_data.feedback,
        position=record_data.position.value,
        evaluation_details=record_data.evaluation_details,
    )

    db.add(record)
    await db.commit()
    await db.refresh(record)

    return InterviewRecordSaveResponse(
        record_id=record.id if record.id is not None else "", message="Record saved successfully"
    )


# Progress Analytics
@router.get("/{user_id}/progress", response_model=GetProgressResponse)
async def get_user_progress(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    position: str | None = Query(None),
    time_range: str = Query("30days", regex="^(7days|30days|90days)$"),
):
    """Get user's progress analytics"""

    user_stmt = select(models.User).where(models.User.id == user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Calculate date range
    days = {"7days": 7, "30days": 30, "90days": 90}[time_range]
    start_date = datetime.now(UTC) - timedelta(days=days)

    base_query = select(models.InterviewRecord).where(
        and_(
            models.InterviewRecord.user_id == user_id,
            models.InterviewRecord.created_at >= start_date,
        )
    )

    if position:
        base_query = base_query.where(models.InterviewRecord.position == position)

    # Get daily progress data
    progress_query = (
        select(
            func.date(models.InterviewRecord.created_at).label("date"),
            func.avg(models.InterviewRecord.score).label("avg_score"),
            func.count(models.InterviewRecord.id).label("question_count"),
        )
        .where(
            and_(
                models.InterviewRecord.user_id == user_id,
                models.InterviewRecord.created_at >= start_date,
            )
        )
        .group_by(func.date(models.InterviewRecord.created_at))
    )

    if position:
        progress_query = progress_query.where(models.InterviewRecord.position == position)

    progress_result = await db.execute(progress_query)
    progress_data = [
        ProgressData(
            date=str(row.date), score=float(row.avg_score), question_count=row.question_count
        )
        for row in progress_result.fetchall()
    ]

    # Get overall statistics
    stats_query = select(
        func.count(models.InterviewRecord.id).label("total_questions"),
        func.avg(models.InterviewRecord.score).label("avg_score"),
        func.max(models.InterviewRecord.score).label("best_score"),
        func.min(models.InterviewRecord.score).label("worst_score"),
    ).where(
        and_(
            models.InterviewRecord.user_id == user_id,
            models.InterviewRecord.created_at >= start_date,
        )
    )

    if position:
        stats_query = stats_query.where(models.InterviewRecord.position == position)

    stats_result = await db.execute(stats_query)
    stats = stats_result.first()

    if stats is None:
        stats = type(
            "Stats",
            (),
            {
                "total_questions": 0,
                "avg_score": 0.0,
                "best_score": 0,
                "worst_score": 0,
            },
        )()

    # Get position breakdown
    position_query = (
        select(
            models.InterviewRecord.position,
            func.count(models.InterviewRecord.id).label("question_count"),
            func.avg(models.InterviewRecord.score).label("avg_score"),
        )
        .where(
            and_(
                models.InterviewRecord.user_id == user_id,
                models.InterviewRecord.created_at >= start_date,
            )
        )
        .group_by(models.InterviewRecord.position)
    )

    position_result = await db.execute(position_query)
    position_breakdown = [
        PositionBreakdown(
            position=row.position,
            question_count=row.question_count,
            average_score=float(row.avg_score),
        )
        for row in position_result.fetchall()
    ]

    # Calculate improvement rate (simplified)
    improvement_rate = 0.0
    if len(progress_data) > 1:
        first_score = progress_data[0].score
        last_score = progress_data[-1].score
        improvement_rate = (
            ((last_score - first_score) / first_score) * 100 if first_score > 0 else 0
        )

    statistics = ProgressStatistics(
        total_questions=stats.total_questions or 0,
        average_score=float(stats.avg_score) if stats.avg_score else 0.0,
        improvement_rate=improvement_rate,
        best_score=stats.best_score or 0,
        worst_score=stats.worst_score or 0,
        current_streak=len(progress_data),  # Simplified streak calculation
        total_practice_time=len(progress_data) * 15,  # Assume 15 min per session
    )

    return GetProgressResponse(
        progress_data=progress_data, statistics=statistics, position_breakdown=position_breakdown
    )


# User Preferences Management
@router.get("/{user_id}/preferences", response_model=UserPreferencesOut)
async def get_user_preferences(user_id: int, db: AsyncSession = Depends(get_db)):
    """Get user's interview preferences"""

    # Verify user exists
    user_stmt = select(models.User).where(models.User.id == user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Get preferences
    prefs_stmt = select(models.UserPreferences).where(models.UserPreferences.user_id == user_id)
    prefs_result = await db.execute(prefs_stmt)
    preferences = prefs_result.scalar_one_or_none()

    if not preferences:
        # Create default preferences if they don't exist
        preferences = models.UserPreferences(user_id=user_id)
        db.add(preferences)
        await db.commit()
        await db.refresh(preferences)

    return UserPreferencesOut.model_validate(preferences)


@router.put("/{user_id}/preferences", response_model=UserPreferencesOut)
async def update_user_preferences(
    user_id: int,
    preferences_update: UserPreferencesUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update user's interview preferences"""

    # Verify user exists
    user_stmt = select(models.User).where(models.User.id == user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Get or create preferences
    prefs_stmt = select(models.UserPreferences).where(models.UserPreferences.user_id == user_id)
    prefs_result = await db.execute(prefs_stmt)
    preferences = prefs_result.scalar_one_or_none()

    if not preferences:
        preferences = models.UserPreferences(user_id=user_id)
        db.add(preferences)

    # Update preferences
    update_data = preferences_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(preferences, field):
            setattr(preferences, field, value)

    preferences.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(preferences)

    return UserPreferencesOut.model_validate(preferences)
