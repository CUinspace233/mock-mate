from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import models
from api.deps import get_db
from datetime import datetime, UTC
from database.schemas import (
    StartSessionRequest,
    StartSessionResponse,
    CompleteSessionRequest,
    CompleteSessionResponse,
    SessionSummary,
    SessionDetailResponse,
    SessionType,
)

router = APIRouter()


@router.post("/start", response_model=StartSessionResponse)
async def start_session(request: StartSessionRequest, db: AsyncSession = Depends(get_db)):
    """Start a new interview session"""
    try:
        user_stmt = select(models.User).where(models.User.id == int(request.user_id))
        user_result = await db.execute(user_stmt)
        user = user_result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        session = models.InterviewSession(
            user_id=int(request.user_id),
            position=request.position.value,
            session_type=request.session_type.value if request.session_type else "practice",
        )

        db.add(session)
        await db.commit()
        await db.refresh(session)

        return StartSessionResponse(
            session_id=str(session.id) if session.id is not None else "",
            user_id=session.user_id if session.user_id is not None else 0,
            position=session.position or "",
            status=session.status or "",
            started_at=session.started_at or datetime.now(UTC),
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid user_id: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start session: {str(e)}",
        )


@router.put("/{session_id}/complete", response_model=CompleteSessionResponse)
async def complete_session(
    session_id: str, request: CompleteSessionRequest, db: AsyncSession = Depends(get_db)
):
    """Complete an interview session"""
    try:
        session_stmt = select(models.InterviewSession).where(
            models.InterviewSession.id == session_id
        )
        session_result = await db.execute(session_stmt)
        session = session_result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        # Verify user owns the session
        if session.user_id != request.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to complete this session",
            )

        # Get session records for summary
        records_stmt = select(models.InterviewRecord).where(
            models.InterviewRecord.session_id == session_id
        )
        records_result = await db.execute(records_stmt)
        records = records_result.scalars().all()

        # Calculate summary
        total_questions = len(records)
        average_score = (
            sum(record.score or 0 for record in records) / total_questions
            if total_questions > 0
            else 0
        )

        # Ensure started_at is offset-aware
        started_at = session.started_at
        if started_at is not None and started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=UTC)

        total_duration = int(
            (datetime.now(UTC) - (started_at or datetime.now(UTC))).total_seconds() / 60
        )

        # Analyze strengths and improvements
        all_evaluations = []
        for record in records:
            if record.evaluation_details:
                all_evaluations.append(record.evaluation_details)

        strengths = (
            ["Problem-solving approach", "Technical knowledge"]
            if average_score >= 70
            else ["Basic understanding"]
        )
        improvements = (
            ["Communication clarity", "Depth of explanation"]
            if average_score < 80
            else ["Minor optimizations"]
        )

        # Update session
        session.status = "completed"
        session.completed_at = datetime.now(UTC)

        await db.commit()
        await db.refresh(session)

        summary = SessionSummary(
            total_questions=total_questions,
            average_score=average_score,
            total_duration=total_duration,
            strengths=strengths,
            areas_for_improvement=improvements,
        )

        return CompleteSessionResponse(
            session_id=str(session.id) if session.id is not None else "",
            status=session.status,
            completed_at=session.completed_at,
            summary=summary,
        )

    except Exception as e:
        print("Complete session error:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete session: {str(e)}",
        )


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get session details"""
    session_stmt = select(models.InterviewSession).where(models.InterviewSession.id == session_id)
    session_result = await db.execute(session_stmt)
    session = session_result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    records_stmt = select(models.InterviewRecord).where(
        models.InterviewRecord.session_id == session_id
    )
    records_result = await db.execute(records_stmt)
    records = records_result.scalars().all()

    return SessionDetailResponse(
        session_id=str(session.id),
        user_id=session.user_id if session.user_id is not None else 0,
        position=session.position or "",
        status=session.status or "",
        session_type=(
            SessionType(session.session_type) if session.session_type else SessionType.PRACTICE
        ),
        started_at=session.started_at or datetime.now(UTC),
        completed_at=session.completed_at or None,
        records_count=len(records),
    )
