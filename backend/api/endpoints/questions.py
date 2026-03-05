import json
from datetime import UTC, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from openai import OpenAI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_db
from database import models
from database.schemas import (
    GeneratedQuestion,
    GenerateFollowUpRequest,
    GenerateQuestionRequest,
    GenerateQuestionResponse,
    QuestionCategoriesResponse,
    QuestionCategory,
    QuestionOut,
    QuestionType,
    TopicCount,
)

router = APIRouter()

LANGUAGE_NAMES = {
    "en": "English",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
}


def _lang_prompt(lang: str) -> str:
    """Return a prompt suffix requiring the given language."""
    if lang == "en":
        return ""
    name = LANGUAGE_NAMES.get(lang, lang)
    return f" You MUST generate the entire question in {name}. Do NOT use English."


def _lang_system(lang: str) -> str:
    """Return a system-instruction suffix requiring the given language."""
    if lang == "en":
        return ""
    name = LANGUAGE_NAMES.get(lang, lang)
    return f" IMPORTANT: You must respond entirely in {name}. Never use English in your response."


def _get_client(api_key: str = "") -> OpenAI:
    """Create OpenAI client using provided key, fallback to env var."""
    return OpenAI(api_key=api_key) if api_key else OpenAI()


async def generate_ai_question(
    position: str,
    difficulty: str,
    question_type: QuestionType | None = QuestionType.TECHNICAL,
    openai_api_key: str = "",
    language: str = "en",
    openai_model: str = "gpt-4.1-nano",
) -> GeneratedQuestion:
    """Generate a question using AI (OpenAI GPT)"""
    client = _get_client(openai_api_key)
    prompt = (
        f"Generate a {difficulty} level {question_type} interview question for a {position} position. "
        "The question must be specific and knowledge-based — test a concrete concept, principle, API, "
        "algorithm, or technical detail. Do NOT ask broad or open-ended questions like 'Tell me about...' "
        "or 'Describe your experience with...'. Return only the question." + _lang_prompt(language)
    )

    response = client.responses.create(
        model=openai_model,
        instructions=("You are an expert interview question generator." + _lang_system(language)),
        input=prompt,
        max_output_tokens=100,
        temperature=0.9,
    )

    question_content = (response.output_text or "").strip()

    return GeneratedQuestion(
        content=question_content,
        question_type=question_type or QuestionType.TECHNICAL,
        position=position,
        difficulty=difficulty,
        expected_keywords=[
            "technical",
            "explanation",
            "examples",
        ],
    )


@router.post("/generate/stream")
async def generate_question_stream(
    req: GenerateQuestionRequest, db: AsyncSession = Depends(get_db)
):
    client = _get_client(req.openai_api_key)
    lang_p = _lang_prompt(req.language)
    if req.is_last_question:
        prompt = (
            f"Generate a {req.difficulty} level {req.question_type} interview question for a {req.position} position. "
            "This is the final question — it can be a broader, open-ended question that tests the candidate's "
            "overall understanding, design thinking, or practical experience. Return only the question."
            + lang_p
        )
    else:
        prompt = (
            f"Generate a {req.difficulty} level {req.question_type} interview question for a {req.position} position. "
            "The question must be specific and knowledge-based — test a concrete concept, principle, API, "
            "algorithm, or technical detail. Do NOT ask broad or open-ended questions like 'Tell me about...' "
            "or 'Describe your experience with...'. Return only the question." + lang_p
        )

    async def sse_iter():
        content = ""
        response_id = None

        with client.responses.stream(
            model=req.openai_model,
            instructions=(
                "You are an expert interview question generator. "
                "Always generate specific, knowledge-based questions that test concrete understanding. "
                "Avoid broad, open-ended, or experience-based questions."
                + _lang_system(req.language)
            ),
            input=prompt,
            max_output_tokens=100,
            temperature=0.9,
        ) as stream:
            for event in stream:
                if event.type == "response.output_text.delta":
                    delta = event.delta
                    if not delta:
                        continue
                    content += delta
                    yield f"event: content\ndata: {json.dumps({'delta': delta})}\n\n"
            final_response = stream.get_final_response()
            response_id = final_response.id

        # Save question to database so /answers/evaluate can find it
        question = models.Question(
            content=content.strip(),
            position=req.position,
            difficulty=req.difficulty or "easy",
            question_type=req.question_type,
            expected_keywords=["technical", "explanation", "examples"],
        )
        db.add(question)
        await db.commit()
        await db.refresh(question)

        final = {
            "question_id": str(question.id),
            "content": content.strip(),
            "position": req.position,
            "difficulty": req.difficulty or "easy",
            "question_type": req.question_type,
            "expected_keywords": ["technical", "explanation", "examples"],
            "created_at": (question.created_at or datetime.now(timezone.utc)).isoformat(),
            "response_id": response_id,
        }
        yield f"event: final\ndata: {json.dumps(final)}\n\n"
        yield "event: end\ndata: {}\n\n"

    return StreamingResponse(sse_iter(), media_type="text/event-stream")


@router.post("/generate/followup/stream")
async def generate_followup_stream(
    req: GenerateFollowUpRequest, db: AsyncSession = Depends(get_db)
):
    """Generate a follow-up question based on conversation history, streamed via SSE."""
    client = _get_client(req.openai_api_key)

    # Build conversation context for OpenAI
    conversation_text = ""
    for entry in req.conversation_history:
        label = "Interviewer" if entry.role == "interviewer" else "Candidate"
        conversation_text += f"{label}: {entry.content}\n\n"

    prompt = (
        f"Position: {req.position}, Difficulty: {req.difficulty}\n"
        f"This is follow-up #{req.follow_up_number} of {req.max_follow_ups}.\n\n"
        f"Conversation so far:\n{conversation_text}\n"
        "Based on the candidate's last answer, generate a probing follow-up question "
        "that digs deeper into their understanding. The follow-up must be specific and knowledge-based — "
        "ask about a concrete concept, mechanism, or technical detail related to their answer. "
        "Return only the follow-up question." + _lang_prompt(req.language)
    )

    async def sse_iter():
        content = ""
        response_id = None

        with client.responses.stream(
            model=req.openai_model,
            instructions=(
                "You are an expert technical interviewer conducting a multi-round interview. "
                "Generate specific, knowledge-based follow-up questions that probe concrete technical details "
                "based on the candidate's previous answers. Avoid broad or open-ended questions."
                + _lang_system(req.language)
            ),
            input=prompt,
            max_output_tokens=150,
            temperature=0.7,
        ) as stream:
            for event in stream:
                if event.type == "response.output_text.delta":
                    delta = event.delta
                    if not delta:
                        continue
                    content += delta
                    yield f"event: content\ndata: {json.dumps({'delta': delta})}\n\n"
            final_response = stream.get_final_response()
            response_id = final_response.id

        # Save follow-up question to database
        question = models.Question(
            content=content.strip(),
            position=req.position,
            difficulty=req.difficulty or "medium",
            question_type=QuestionType.TECHNICAL,
            expected_keywords=["depth", "understanding", "follow-up"],
        )
        db.add(question)
        await db.commit()
        await db.refresh(question)

        final = {
            "question_id": str(question.id),
            "content": content.strip(),
            "position": req.position,
            "difficulty": req.difficulty or "medium",
            "question_type": QuestionType.TECHNICAL,
            "expected_keywords": ["depth", "understanding", "follow-up"],
            "created_at": (question.created_at or datetime.now(timezone.utc)).isoformat(),
            "response_id": response_id,
            "is_follow_up": True,
            "follow_up_number": req.follow_up_number,
        }
        yield f"event: final\ndata: {json.dumps(final)}\n\n"
        yield "event: end\ndata: {}\n\n"

    return StreamingResponse(sse_iter(), media_type="text/event-stream")


@router.post("/generate", response_model=GenerateQuestionResponse)
async def generate_question(
    request: GenerateQuestionRequest, db: AsyncSession = Depends(get_db)
) -> GenerateQuestionResponse:
    """Generate a new interview question"""
    try:
        question_data = await generate_ai_question(
            request.position,
            request.difficulty.value if request.difficulty else "medium",
            request.question_type,
            request.openai_api_key,
            request.language,
            request.openai_model,
        )

        question = models.Question(
            content=question_data.content,
            position=question_data.position,
            difficulty=question_data.difficulty,
            question_type=question_data.question_type,
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
            question_type=request.question_type or QuestionType.TECHNICAL,
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

        # Get question types with counts
        question_types_query = (
            select(
                models.Question.position,
                models.Question.question_type,
                func.count(models.Question.id).label("count"),
            )
            .where(models.Question.question_type.isnot(None))
            .group_by(models.Question.position, models.Question.question_type)
        )

        question_types_result = await db.execute(question_types_query)
        question_types_data = question_types_result.fetchall()

        question_types = [
            TopicCount(position=qt[0], question_type=qt[1], count=qt[2])
            for qt in question_types_data
        ]

        return QuestionCategoriesResponse(positions=positions, question_types=question_types)

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
