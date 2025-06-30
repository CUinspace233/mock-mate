from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import models
from api.deps import get_db
from datetime import datetime, UTC
from openai import OpenAI
from database.schemas import (
    GeneratedQuestion,
    GenerateQuestionRequest,
    GenerateQuestionResponse,
    QuestionCategory,
    QuestionCategoriesResponse,
    QuestionOut,
    TopicCount,
)


router = APIRouter()

client = OpenAI()


async def generate_ai_question(
    position: str, difficulty: str, topic: str | None = None
) -> GeneratedQuestion:
    """Generate a question using AI (OpenAI GPT)"""
    prompt = (
        f"Generate a {difficulty} level interview question for a {position} position"
        + (f" about {topic}." if topic else " about any topic.")
        + " Return only the question."
    )

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "You are an expert interview question generator."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=100,
        temperature=0.9,
        frequency_penalty=0.8,
        presence_penalty=0.8,
    )

    question_content = (response.choices[0].message.content or "").strip()

    return GeneratedQuestion(
        content=question_content,
        position=position,
        difficulty=difficulty,
        topic=topic or "general",
        expected_keywords=[
            "technical",
            "explanation",
            "examples",
        ],
    )


@router.post("/generate", response_model=GenerateQuestionResponse)
async def generate_question(
    request: GenerateQuestionRequest, db: AsyncSession = Depends(get_db)
) -> GenerateQuestionResponse:
    """Generate a new interview question"""
    try:
        question_data = await generate_ai_question(
            request.position.value,
            request.difficulty.value if request.difficulty else "medium",
            request.topic,
        )

        question = models.Question(
            content=question_data.content,
            position=question_data.position,
            difficulty=question_data.difficulty,
            topic=question_data.topic,
            expected_keywords=question_data.expected_keywords,
        )

        db.add(question)
        await db.commit()
        await db.refresh(question)

        return GenerateQuestionResponse(
            question_id=str(question.id),
            content=question.content or "",
            position=question.position or "",
            difficulty=question.difficulty or "",
            topic=question.topic or "",
            expected_keywords=question.expected_keywords or [],
            created_at=question.created_at or datetime.now(UTC),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate question: {str(e)}",
        )


@router.get("/categories", response_model=QuestionCategoriesResponse)
async def get_question_categories(db: AsyncSession = Depends(get_db)):
    """Get available question categories and positions"""
    try:
        # Get positions with question counts
        positions_query = select(
            models.Question.position, func.count(models.Question.id).label("count")
        ).group_by(models.Question.position)

        positions_result = await db.execute(positions_query)
        positions_data = positions_result.fetchall()

        positions = [
            QuestionCategory(value=pos[0], label=pos[0].title(), question_count=pos[1])
            for pos in positions_data
        ]

        # Get topics with counts
        topics_query = (
            select(
                models.Question.position,
                models.Question.topic,
                func.count(models.Question.id).label("count"),
            )
            .where(models.Question.topic.isnot(None))
            .group_by(models.Question.position, models.Question.topic)
        )

        topics_result = await db.execute(topics_query)
        topics_data = topics_result.fetchall()

        topics = [
            TopicCount(position=topic[0], topic=topic[1], count=topic[2]) for topic in topics_data
        ]

        return QuestionCategoriesResponse(positions=positions, topics=topics)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get categories: {str(e)}",
        )


@router.get("/{question_id}", response_model=QuestionOut)
async def get_question(question_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific question by ID"""
    stmt = select(models.Question).where(models.Question.id == question_id)
    result = await db.execute(stmt)
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    return question
