import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.deps import get_db
from database import models
from database.schemas import (
    AnswerEvaluationResult,
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    EvaluateFollowUpRequest,
    EvaluationDetails,
)

router = APIRouter()


EVALUATION_TEXT_FORMAT = {
    "format": {
        "type": "json_schema",
        "name": "answer_evaluation",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "score": {"type": "integer"},
                "feedback": {"type": "string"},
                "strengths": {"type": "array", "items": {"type": "string"}},
                "improvements": {"type": "array", "items": {"type": "string"}},
                "keywords_covered": {"type": "array", "items": {"type": "string"}},
                "keywords_missed": {"type": "array", "items": {"type": "string"}},
                "technical_accuracy": {"type": "number"},
                "communication_clarity": {"type": "number"},
                "completeness": {"type": "number"},
                "practical_experience": {"type": "number"},
            },
            "required": [
                "score",
                "feedback",
                "strengths",
                "improvements",
                "keywords_covered",
                "keywords_missed",
                "technical_accuracy",
                "communication_clarity",
                "completeness",
                "practical_experience",
            ],
            "additionalProperties": False,
        },
    },
}


async def evaluate_answer_ai(
    question_content: str,
    answer: str,
    expected_keywords: list[str],
    openai_api_key: str = "",
    openai_model: str = "gpt-4.1-nano",
) -> AnswerEvaluationResult:
    """AI-powered answer evaluation using OpenAI GPT with structured output"""
    client = OpenAI(api_key=openai_api_key) if openai_api_key else OpenAI()

    prompt = f"""
    Evaluate this interview answer based on the question and expected keywords.

    Question: {question_content}
    Expected Keywords: {', '.join(expected_keywords)}
    Answer: {answer}

    Score based on: technical accuracy (40%), communication clarity (30%), completeness (20%), practical experience (10%).
    All sub-scores (technical_accuracy, communication_clarity, completeness, practical_experience) should be 0-100.
    The overall score should also be 0-100.
    """

    try:
        response = client.responses.create(
            model=openai_model,
            instructions="You are an expert technical interviewer. Evaluate answers objectively and provide constructive feedback.",
            input=prompt,
            max_output_tokens=800,
            temperature=0.3,
            text=EVALUATION_TEXT_FORMAT,
        )

        evaluation = json.loads(response.output_text or "{}")

        evaluation_details = EvaluationDetails(
            technical_accuracy=min(max(float(evaluation["technical_accuracy"]), 0), 100),
            communication_clarity=min(max(float(evaluation["communication_clarity"]), 0), 100),
            completeness=min(max(float(evaluation["completeness"]), 0), 100),
            practical_experience=min(max(float(evaluation["practical_experience"]), 0), 100),
        )

        return AnswerEvaluationResult(
            score=min(max(int(evaluation["score"]), 0), 100),
            feedback=evaluation["feedback"],
            strengths=evaluation["strengths"],
            improvements=evaluation["improvements"],
            keywords_covered=evaluation["keywords_covered"],
            keywords_missed=evaluation["keywords_missed"],
            evaluation_details=evaluation_details,
        )

    except Exception as e:
        import traceback

        print(f"AI evaluation failed: {e}\n{traceback.format_exc()}")
        return evaluate_answer_mock(question_content, answer, expected_keywords)


def evaluate_answer_mock(
    question_content: str, answer: str, expected_keywords: list[str]
) -> AnswerEvaluationResult:
    """Mock answer evaluation - fallback when AI evaluation fails"""

    # Simple scoring based on answer length and keyword matching
    answer_length = len(answer.split())
    keyword_matches = sum(1 for keyword in expected_keywords if keyword.lower() in answer.lower())

    # Basic scoring algorithm
    length_score = min(answer_length / 50 * 40, 40)  # Max 40 points for length
    keyword_score = (
        keyword_matches / max(len(expected_keywords), 1)
    ) * 30  # Max 30 points for keywords
    structure_score = 20 if answer_length > 20 else answer_length  # Max 20 points for structure
    clarity_score = 10  # Default clarity score

    total_score = int(length_score + keyword_score + structure_score + clarity_score)
    total_score = min(total_score, 100)  # Cap at 100

    # Generate feedback based on score
    if total_score >= 80:
        feedback = "Excellent answer! You demonstrated strong understanding and provided comprehensive details."
        strengths = ["Clear explanation", "Good technical depth", "Well structured"]
        improvements = ["Consider adding more examples"]
    elif total_score >= 60:
        feedback = "Good answer with room for improvement. You covered the main points but could expand on some areas."
        strengths = ["Basic understanding shown", "Relevant points covered"]
        improvements = [
            "Add more technical details",
            "Provide concrete examples",
            "Improve structure",
        ]
    else:
        feedback = "Your answer needs significant improvement. Consider studying the topic more thoroughly."
        strengths = ["Attempted to answer"]
        improvements = [
            "Study fundamental concepts",
            "Practice technical explanations",
            "Add more detail",
        ]

    # Determine covered and missed keywords
    covered_keywords = [kw for kw in expected_keywords if kw.lower() in answer.lower()]
    missed_keywords = [kw for kw in expected_keywords if kw not in covered_keywords]

    # Create evaluation details object
    evaluation_details = EvaluationDetails(
        technical_accuracy=length_score / 40 * 100,
        communication_clarity=clarity_score / 10 * 100,
        completeness=keyword_score / 30 * 100,
        practical_experience=structure_score / 20 * 100,
    )

    return AnswerEvaluationResult(
        score=total_score,
        feedback=feedback,
        strengths=strengths,
        improvements=improvements,
        keywords_covered=covered_keywords,
        keywords_missed=missed_keywords,
        evaluation_details=evaluation_details,
    )


@router.post("/evaluate", response_model=EvaluateAnswerResponse)
async def evaluate_answer(request: EvaluateAnswerRequest, db: AsyncSession = Depends(get_db)):
    """Submit and evaluate user's answer"""
    try:
        # Get the question
        question_stmt = select(models.Question).where(models.Question.id == request.question_id)
        question_result = await db.execute(question_stmt)
        question = question_result.scalar_one_or_none()

        if not question:
            # Try to get from news_based_questions, and eager load the related Question
            news_question_stmt = (
                select(models.NewsBasedQuestion)
                .where(models.NewsBasedQuestion.id == request.question_id)
                .options(selectinload(models.NewsBasedQuestion.question))
            )
            news_question_result = await db.execute(news_question_stmt)
            news_question = news_question_result.scalar_one_or_none()
            if not news_question:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Question not found"
                )
            question_content = news_question.question.content
            expected_keywords = news_question.question.expected_keywords
        else:
            question_content = question.content
            expected_keywords = question.expected_keywords

        # Evaluate the answer using AI with provided API key
        evaluation = await evaluate_answer_ai(
            question_content or "",
            request.answer,
            expected_keywords or [],
            request.openai_api_key,
            request.openai_model,
        )

        answer_evaluation = models.AnswerEvaluation(
            question_id=request.question_id,
            user_id=int(request.user_id),
            answer=request.answer,
            score=evaluation.score,
            feedback=evaluation.feedback,
            strengths=evaluation.strengths,
            improvements=evaluation.improvements,
            keywords_covered=evaluation.keywords_covered,
            keywords_missed=evaluation.keywords_missed,
            evaluation_details=evaluation.evaluation_details.model_dump(),
        )

        db.add(answer_evaluation)
        await db.commit()
        await db.refresh(answer_evaluation)

        return EvaluateAnswerResponse(
            evaluation_id=str(answer_evaluation.id),
            score=evaluation.score,
            feedback=evaluation.feedback,
            strengths=evaluation.strengths,
            improvements=evaluation.improvements,
            keywords_covered=evaluation.keywords_covered,
            keywords_missed=evaluation.keywords_missed,
            evaluation_details=evaluation.evaluation_details,
            created_at=answer_evaluation.created_at or datetime.now(UTC),
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid user_id: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate answer: {str(e)}",
        )


async def evaluate_followup_ai(
    original_question: str,
    conversation_history: list[dict],
    openai_api_key: str = "",
    openai_model: str = "gpt-4.1-nano",
) -> AnswerEvaluationResult:
    """AI-powered evaluation of a full multi-turn interview conversation."""
    client = OpenAI(api_key=openai_api_key) if openai_api_key else OpenAI()

    conversation_text = ""
    for entry in conversation_history:
        label = "Interviewer" if entry["role"] == "interviewer" else "Candidate"
        conversation_text += f"{label}: {entry['content']}\n\n"

    prompt = f"""
    Evaluate this multi-round interview conversation holistically.

    Original Question: {original_question}

    Full Conversation:
    {conversation_text}

    Score based on: technical accuracy (40%), communication clarity (30%), completeness (20%), practical experience (10%).
    Consider how well the candidate handled follow-up questions and whether their answers showed depth of understanding.
    All sub-scores (technical_accuracy, communication_clarity, completeness, practical_experience) should be 0-100.
    The overall score should also be 0-100.
    """

    try:
        response = client.responses.create(
            model=openai_model,
            instructions=(
                "You are an expert technical interviewer. Evaluate the entire multi-turn "
                "conversation objectively. Pay special attention to how the candidate responds "
                "to follow-up questions — do they demonstrate deeper understanding, or do they "
                "falter under probing? Provide constructive feedback."
            ),
            input=prompt,
            max_output_tokens=800,
            temperature=0.3,
            text=EVALUATION_TEXT_FORMAT,
        )

        evaluation = json.loads(response.output_text or "{}")

        evaluation_details = EvaluationDetails(
            technical_accuracy=min(max(float(evaluation["technical_accuracy"]), 0), 100),
            communication_clarity=min(max(float(evaluation["communication_clarity"]), 0), 100),
            completeness=min(max(float(evaluation["completeness"]), 0), 100),
            practical_experience=min(max(float(evaluation["practical_experience"]), 0), 100),
        )

        return AnswerEvaluationResult(
            score=min(max(int(evaluation["score"]), 0), 100),
            feedback=evaluation["feedback"],
            strengths=evaluation["strengths"],
            improvements=evaluation["improvements"],
            keywords_covered=evaluation["keywords_covered"],
            keywords_missed=evaluation["keywords_missed"],
            evaluation_details=evaluation_details,
        )

    except Exception as e:
        import traceback

        print(f"AI follow-up evaluation failed: {e}\n{traceback.format_exc()}")
        # Fallback: concatenate all candidate answers and use mock evaluation
        all_answers = " ".join(
            entry["content"] for entry in conversation_history if entry["role"] == "candidate"
        )
        return evaluate_answer_mock(original_question, all_answers, [])


@router.post("/evaluate/followup", response_model=EvaluateAnswerResponse)
async def evaluate_followup(request: EvaluateFollowUpRequest, db: AsyncSession = Depends(get_db)):
    """Evaluate an entire multi-turn interview conversation."""
    try:
        conversation_dicts = [
            {"role": entry.role, "content": entry.content} for entry in request.conversation_history
        ]

        evaluation = await evaluate_followup_ai(
            request.original_question,
            conversation_dicts,
            request.openai_api_key,
            request.openai_model,
        )

        # Concatenate all candidate answers for the record
        all_answers = "\n---\n".join(
            entry.content for entry in request.conversation_history if entry.role == "candidate"
        )

        answer_evaluation = models.AnswerEvaluation(
            question_id=request.question_id,
            user_id=int(request.user_id),
            answer=all_answers,
            score=evaluation.score,
            feedback=evaluation.feedback,
            strengths=evaluation.strengths,
            improvements=evaluation.improvements,
            keywords_covered=evaluation.keywords_covered,
            keywords_missed=evaluation.keywords_missed,
            evaluation_details=evaluation.evaluation_details.model_dump(),
        )

        db.add(answer_evaluation)
        await db.commit()
        await db.refresh(answer_evaluation)

        return EvaluateAnswerResponse(
            evaluation_id=str(answer_evaluation.id),
            score=evaluation.score,
            feedback=evaluation.feedback,
            strengths=evaluation.strengths,
            improvements=evaluation.improvements,
            keywords_covered=evaluation.keywords_covered,
            keywords_missed=evaluation.keywords_missed,
            evaluation_details=evaluation.evaluation_details,
            created_at=answer_evaluation.created_at or datetime.now(UTC),
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid user_id: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate follow-up conversation: {str(e)}",
        )
