from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import models
from api.deps import get_db
from datetime import datetime, UTC
from openai import OpenAI
from database.schemas import (
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    EvaluationDetails,
    AnswerEvaluationResult,
)
import json

router = APIRouter()

client = OpenAI()


async def evaluate_answer_ai(
    question_content: str, answer: str, expected_keywords: list[str]
) -> AnswerEvaluationResult:
    """AI-powered answer evaluation using OpenAI GPT"""

    prompt = f"""
    Evaluate this interview answer based on the question and expected keywords.
    
    Question: {question_content}
    Expected Keywords: {', '.join(expected_keywords)}
    Answer: {answer}
    
    Provide evaluation in this exact JSON format:
    {{
        "score": <integer 0-100>,
        "feedback": "<detailed feedback string>",
        "strengths": ["<strength1>", "<strength2>", "<strength3>"],
        "improvements": ["<improvement1>", "<improvement2>", "<improvement3>"],
        "keywords_covered": ["<covered_keyword1>", "<covered_keyword2>"],
        "keywords_missed": ["<missed_keyword1>", "<missed_keyword2>"],
        "technical_accuracy": <float 0-100>,
        "communication_clarity": <float 0-100>,
        "completeness": <float 0-100>,
        "practical_experience": <float 0-100>
    }}
    
    Score based on: technical accuracy (40%), communication clarity (30%), completeness (20%), practical experience (10%).
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert technical interviewer. Evaluate answers objectively and provide constructive feedback. Always respond with valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=800,
            temperature=0.3,
        )

        evaluation_text = (response.choices[0].message.content or "").strip()

        # Parse the JSON response
        evaluation = json.loads(evaluation_text)

        # Create evaluation details object
        evaluation_details = EvaluationDetails(
            technical_accuracy=min(max(float(evaluation.get("technical_accuracy", 0)), 0), 100),
            communication_clarity=min(
                max(float(evaluation.get("communication_clarity", 0)), 0), 100
            ),
            completeness=min(max(float(evaluation.get("completeness", 0)), 0), 100),
            practical_experience=min(max(float(evaluation.get("practical_experience", 0)), 0), 100),
        )

        # Return typed result
        return AnswerEvaluationResult(
            score=min(max(int(evaluation.get("score", 0)), 0), 100),
            feedback=evaluation.get("feedback", "No feedback provided"),
            strengths=evaluation.get("strengths", ["Answer provided"]),
            improvements=evaluation.get("improvements", ["Could be more detailed"]),
            keywords_covered=evaluation.get("keywords_covered", []),
            keywords_missed=evaluation.get("keywords_missed", expected_keywords),
            evaluation_details=evaluation_details,
        )

    except (json.JSONDecodeError, KeyError, ValueError) as e:
        # Fallback to mock evaluation if AI fails
        print(f"AI evaluation failed: {e}, falling back to mock evaluation")
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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

        # Evaluate the answer using AI
        evaluation = await evaluate_answer_ai(
            question.content or "", request.answer, question.expected_keywords or []
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

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid user_id: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate answer: {str(e)}",
        )
