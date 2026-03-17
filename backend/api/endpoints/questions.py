import asyncio
import json
import logging
import threading
import time
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openai import OpenAI
from sqlalchemy import func, or_, select, update
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
    QuestionStatus,
    QuestionType,
    RecoverableQuestionResponse,
    TopicCount,
)
from database.session import AsyncSessionLocal

router = APIRouter()
logger = logging.getLogger(__name__)

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


# ---------------------------------------------------------------------------
# Background generation infrastructure
# ---------------------------------------------------------------------------


class _GenerationState:
    """Thread-safe shared state between the OpenAI thread, flush task, and SSE generator."""

    def __init__(self):
        self.deltas: list[str] = []
        self.content: str = ""
        self.done: bool = False
        self.error: str | None = None
        self.response_id: str | None = None
        self._lock = threading.Lock()

    def add_delta(self, delta: str):
        with self._lock:
            self.deltas.append(delta)
            self.content += delta

    def mark_done(self, content: str, response_id: str):
        with self._lock:
            self.content = content
            self.response_id = response_id
            self.done = True

    def mark_error(self, error: str, partial_content: str):
        with self._lock:
            self.error = error
            self.content = partial_content
            self.done = True

    def get_new_deltas(self, cursor: int) -> tuple[list[str], int]:
        with self._lock:
            new = self.deltas[cursor:]
            return new, len(self.deltas)

    def snapshot(self) -> tuple[str, bool, str | None, str | None]:
        with self._lock:
            return self.content, self.done, self.error, self.response_id


def _run_openai_stream_in_thread(
    client: OpenAI,
    model: str,
    instructions: str,
    prompt: str,
    max_output_tokens: int,
    temperature: float,
    state: _GenerationState,
):
    """Run the synchronous OpenAI streaming call in a background thread.

    Writes deltas into the shared state object. On completion or error,
    marks the state accordingly.
    """
    content = ""
    try:
        with client.responses.stream(
            model=model,
            instructions=instructions,
            input=prompt,
            max_output_tokens=max_output_tokens,
            temperature=temperature,
        ) as stream:
            for event in stream:
                if event.type == "response.output_text.delta" and event.delta:
                    content += event.delta
                    state.add_delta(event.delta)
            final_response = stream.get_final_response()
        state.mark_done(content, final_response.id)
    except Exception as e:
        logger.exception("OpenAI stream error")
        state.mark_error(str(e), content)


def _should_flush(content: str, last_flush_time: float) -> bool:
    """Decide whether to flush accumulated content to DB.

    Flush on sentence boundaries (. ? !) or if >1s since last flush.
    """
    if not content:
        return False
    elapsed = time.monotonic() - last_flush_time
    # Sentence-boundary check
    stripped = content.rstrip()
    if stripped and stripped[-1] in ".?!。？！" and elapsed > 0.3:
        return True
    # Time-based floor
    if elapsed >= 1.0:
        return True
    return False


async def _bg_flush_task(question_id: str, state: _GenerationState):
    """Background asyncio task: periodically flushes content to DB.

    Continues running even if the SSE generator is cancelled (client disconnect).
    """
    last_flush = time.monotonic()
    try:
        while True:
            await asyncio.sleep(0.2)
            content, done, error, _ = state.snapshot()

            if _should_flush(content, last_flush) or done:
                try:
                    async with AsyncSessionLocal() as flush_db:
                        if done:
                            final_status = (
                                QuestionStatus.INTERRUPTED if error else QuestionStatus.COMPLETED
                            )
                            await flush_db.execute(
                                update(models.Question)
                                .where(models.Question.id == question_id)
                                .values(
                                    content=content.strip() if content else "",
                                    status=final_status,
                                )
                            )
                        else:
                            await flush_db.execute(
                                update(models.Question)
                                .where(models.Question.id == question_id)
                                .values(content=content.strip())
                            )
                        await flush_db.commit()
                        last_flush = time.monotonic()
                except Exception:
                    logger.exception("Flush error for question %s", question_id)

            if done:
                break
    except Exception:
        logger.exception("Flush task fatal error for question %s", question_id)
        try:
            async with AsyncSessionLocal() as flush_db:
                await flush_db.execute(
                    update(models.Question)
                    .where(models.Question.id == question_id)
                    .values(status=QuestionStatus.INTERRUPTED)
                )
                await flush_db.commit()
        except Exception:
            logger.exception("Failed to mark question %s as interrupted", question_id)


# ---------------------------------------------------------------------------
# AI question generation (non-streaming)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Streaming endpoints
# ---------------------------------------------------------------------------


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

    instructions = (
        "You are an expert interview question generator. "
        "Always generate specific, knowledge-based questions that test concrete understanding. "
        "Avoid broad, open-ended, or experience-based questions." + _lang_system(req.language)
    )

    # Create Question record immediately with status="generating"
    question_id = str(uuid.uuid4())
    question = models.Question(
        id=question_id,
        content="",
        position=req.position,
        difficulty=req.difficulty or "easy",
        question_type=req.question_type,
        expected_keywords=["technical", "explanation", "examples"],
        status=QuestionStatus.GENERATING,
        session_id=req.session_id,
    )
    db.add(question)
    await db.commit()
    created_at = question.created_at or datetime.now(UTC)

    # Shared state: thread writes deltas, flush task + SSE generator read
    state = _GenerationState()

    # Start OpenAI stream in background thread
    thread = threading.Thread(
        target=_run_openai_stream_in_thread,
        args=(client, req.openai_model, instructions, prompt, 100, 0.9, state),
        daemon=True,
    )
    thread.start()

    # Start background flush task (survives SSE disconnect)
    asyncio.create_task(_bg_flush_task(question_id, state))

    # SSE generator: reads from shared state, yields to client
    async def sse_iter():
        yield f"event: init\ndata: {json.dumps({'question_id': question_id})}\n\n"

        cursor = 0
        while True:
            new_deltas, cursor = state.get_new_deltas(cursor)
            for delta in new_deltas:
                yield f"event: content\ndata: {json.dumps({'delta': delta})}\n\n"

            content, done, error, response_id = state.snapshot()
            if done:
                new_deltas, cursor = state.get_new_deltas(cursor)
                for delta in new_deltas:
                    yield f"event: content\ndata: {json.dumps({'delta': delta})}\n\n"

                if error:
                    yield f"event: error\ndata: {json.dumps({'error': error})}\n\n"
                else:
                    final = {
                        "question_id": question_id,
                        "content": content.strip(),
                        "position": req.position,
                        "difficulty": req.difficulty or "easy",
                        "question_type": req.question_type,
                        "expected_keywords": ["technical", "explanation", "examples"],
                        "created_at": created_at.isoformat(),
                        "response_id": response_id,
                    }
                    yield f"event: final\ndata: {json.dumps(final)}\n\n"
                yield "event: end\ndata: {}\n\n"
                break

            await asyncio.sleep(0.05)

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

    instructions = (
        "You are an expert technical interviewer conducting a multi-round interview. "
        "Generate specific, knowledge-based follow-up questions that probe concrete technical details "
        "based on the candidate's previous answers. Avoid broad or open-ended questions."
        + _lang_system(req.language)
    )

    # Create Question record immediately
    question_id = str(uuid.uuid4())
    question = models.Question(
        id=question_id,
        content="",
        position=req.position,
        difficulty=req.difficulty or "medium",
        question_type=QuestionType.TECHNICAL,
        expected_keywords=["depth", "understanding", "follow-up"],
        status=QuestionStatus.GENERATING,
        session_id=req.session_id,
    )
    db.add(question)
    await db.commit()
    created_at = question.created_at or datetime.now(UTC)

    # Shared state: thread writes deltas, flush task + SSE generator read
    state = _GenerationState()

    thread = threading.Thread(
        target=_run_openai_stream_in_thread,
        args=(client, req.openai_model, instructions, prompt, 150, 0.7, state),
        daemon=True,
    )
    thread.start()

    asyncio.create_task(_bg_flush_task(question_id, state))

    async def sse_iter():
        yield f"event: init\ndata: {json.dumps({'question_id': question_id})}\n\n"

        cursor = 0
        while True:
            new_deltas, cursor = state.get_new_deltas(cursor)
            for delta in new_deltas:
                yield f"event: content\ndata: {json.dumps({'delta': delta})}\n\n"

            content, done, error, response_id = state.snapshot()
            if done:
                new_deltas, cursor = state.get_new_deltas(cursor)
                for delta in new_deltas:
                    yield f"event: content\ndata: {json.dumps({'delta': delta})}\n\n"

                if error:
                    yield f"event: error\ndata: {json.dumps({'error': error})}\n\n"
                else:
                    final = {
                        "question_id": question_id,
                        "content": content.strip(),
                        "position": req.position,
                        "difficulty": req.difficulty or "medium",
                        "question_type": QuestionType.TECHNICAL,
                        "expected_keywords": ["depth", "understanding", "follow-up"],
                        "created_at": created_at.isoformat(),
                        "response_id": response_id,
                        "is_follow_up": True,
                        "follow_up_number": req.follow_up_number,
                    }
                    yield f"event: final\ndata: {json.dumps(final)}\n\n"
                yield "event: end\ndata: {}\n\n"
                break

            await asyncio.sleep(0.05)

    return StreamingResponse(sse_iter(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Non-streaming generation
# ---------------------------------------------------------------------------


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
            status=QuestionStatus.COMPLETED,
            session_id=request.session_id,
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


# ---------------------------------------------------------------------------
# Recovery endpoints
# ---------------------------------------------------------------------------


@router.get("/recover")
async def recover_questions(
    session_id: str = Query(...),
    include_completed: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> list[RecoverableQuestionResponse]:
    """Find questions for a session. By default only interrupted/generating; pass include_completed=true to get all."""
    if include_completed:
        status_filter = or_(
            models.Question.status == QuestionStatus.GENERATING,
            models.Question.status == QuestionStatus.INTERRUPTED,
            models.Question.status == QuestionStatus.COMPLETED,
        )
    else:
        status_filter = or_(
            models.Question.status == QuestionStatus.GENERATING,
            models.Question.status == QuestionStatus.INTERRUPTED,
        )
    stmt = (
        select(models.Question)
        .where(
            models.Question.session_id == session_id,
            status_filter,
        )
        .order_by(models.Question.created_at.asc())
    )
    result = await db.execute(stmt)
    questions = result.scalars().all()

    return [
        RecoverableQuestionResponse(
            question_id=str(q.id),
            content=q.content or "",
            status=q.status or "completed",
            position=q.position,
            difficulty=q.difficulty or "medium",
            question_type=q.question_type or "technical",
            created_at=q.created_at or datetime.now(UTC),
        )
        for q in questions
    ]


@router.post("/{question_id}/discard")
async def discard_question(
    question_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Discard an interrupted question."""
    stmt = (
        update(models.Question).where(models.Question.id == question_id).values(status="discarded")
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": "Question discarded"}


# ---------------------------------------------------------------------------
# Other endpoints
# ---------------------------------------------------------------------------


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
