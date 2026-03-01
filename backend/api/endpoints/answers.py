from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import models
from api.deps import get_db
from datetime import datetime, UTC
from openai import OpenAI
from openai.types.shared_params import ResponseFormatJSONSchema
from database.schemas import (
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    EvaluationDetails,
    AnswerEvaluationResult,
)
import json

router = APIRouter()


EVALUATION_SCHEMA: ResponseFormatJSONSchema = {
    "type": "json_schema",
    "json_schema": {
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
    question_content: str, answer: str, expected_keywords: list[str], openai_api_key: str = ""
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
        response = client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert technical interviewer. Evaluate answers objectively and provide constructive feedback.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=800,
            temperature=0.3,
            response_format=EVALUATION_SCHEMA,
        )

        evaluation = json.loads(response.choices[0].message.content or "{}")

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
            question_content or "", request.answer, expected_keywords or [], request.openai_api_key
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
