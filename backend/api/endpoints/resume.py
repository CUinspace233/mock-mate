import io
import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from openai import OpenAI
from pypdf import PdfReader
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_db
from database import models
from database.schemas import ResumeProject, ResumeResource, UploadResumeResponse

router = APIRouter()

MAX_RESUME_BYTES = 5 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md"}

PROJECT_EXTRACTION_TEXT_FORMAT = {
    "format": {
        "type": "json_schema",
        "name": "resume_projects",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "projects": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "project_id": {"type": "string"},
                            "name": {"type": "string"},
                            "role": {"type": "string"},
                            "tech_stack": {"type": "array", "items": {"type": "string"}},
                            "summary": {"type": "string"},
                            "evidence": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": [
                            "project_id",
                            "name",
                            "role",
                            "tech_stack",
                            "summary",
                            "evidence",
                        ],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["projects"],
            "additionalProperties": False,
        },
    },
}


def _extension(filename: str) -> str:
    dot = filename.rfind(".")
    return filename[dot:].lower() if dot >= 0 else ""


def _extract_pdf_text(content: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read PDF resume: {exc}",
        ) from exc

    text = "\n\n".join(page.strip() for page in pages if page.strip()).strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This PDF does not contain extractable text. Scanned/OCR-only PDFs are not supported.",
        )
    return text


def _extract_text(filename: str, content: bytes) -> str:
    ext = _extension(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported resume format. Upload a PDF, TXT, or MD file.",
        )

    if ext == ".pdf":
        return _extract_pdf_text(content)

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("utf-8", errors="ignore")

    text = text.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume text is empty.",
        )
    return text


def _resume_to_resource(resume: models.Resume) -> ResumeResource:
    return ResumeResource(
        id=str(resume.id),
        user_id=resume.user_id,
        filename=resume.filename,
        content_text=resume.content_text,
        projects=[ResumeProject(**project) for project in (resume.projects_json or [])],
        created_at=resume.created_at or datetime.now(UTC),
        updated_at=resume.updated_at or resume.created_at or datetime.now(UTC),
    )


def _fallback_projects(text: str) -> list[dict]:
    lines = [line.strip(" -*\t") for line in text.splitlines() if line.strip()]
    snippets = lines[:8]
    return [
        ResumeProject(
            project_id=str(uuid.uuid4()),
            name="Resume Experience",
            role="",
            tech_stack=[],
            summary=" ".join(snippets)[:800],
            evidence=snippets[:5],
        ).model_dump()
    ]


async def _extract_projects_with_ai(
    text: str,
    openai_api_key: str,
    openai_model: str,
    language: str,
) -> list[dict]:
    client = OpenAI(api_key=openai_api_key) if openai_api_key else OpenAI()
    prompt = f"""
Extract project experiences from this resume. Include only real project/work experiences from the
resume; do not invent projects from skill lists, education, or summaries.

For each project:
- project_id must be a short stable slug or UUID-like string.
- name should be the project/product/company experience title.
- role should be the candidate's role if visible.
- tech_stack should contain concrete technologies mentioned for the project.
- summary should capture responsibility, scope, and outcome.
- evidence should quote or paraphrase resume facts that justify the project.

If no clear project exists, return one project named "Resume Experience" based on the strongest
work experience in the resume.

Language hint for project text: {language}

Resume:
{text[:24000]}
"""

    try:
        response = client.responses.create(
            model=openai_model,
            instructions=(
                "You are a strict resume parser. Extract only evidence-backed project entries "
                "and return valid structured JSON."
            ),
            input=prompt,
            max_output_tokens=1800,
            temperature=0.2,
            text=PROJECT_EXTRACTION_TEXT_FORMAT,
        )
        payload = json.loads(response.output_text or "{}")
        projects = payload.get("projects") or []
        normalized = []
        for project in projects:
            normalized.append(
                ResumeProject(
                    project_id=str(project.get("project_id") or uuid.uuid4()),
                    name=str(project.get("name") or "Resume Experience"),
                    role=str(project.get("role") or ""),
                    tech_stack=[
                        str(item) for item in (project.get("tech_stack") or []) if str(item).strip()
                    ],
                    summary=str(project.get("summary") or ""),
                    evidence=[
                        str(item) for item in (project.get("evidence") or []) if str(item).strip()
                    ],
                ).model_dump()
            )
        return normalized or _fallback_projects(text)
    except Exception:
        return _fallback_projects(text)


@router.get("/current", response_model=ResumeResource | None)
async def get_current_resume(
    user_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.Resume).where(models.Resume.user_id == user_id)
    result = await db.execute(stmt)
    resume = result.scalar_one_or_none()
    return _resume_to_resource(resume) if resume else None


@router.post("/upload", response_model=UploadResumeResponse)
async def upload_resume(
    user_id: int = Form(...),
    openai_api_key: str = Form(""),
    openai_model: str = Form("gpt-5.4-mini"),
    language: str = Form("en"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(models.User).where(models.User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    filename = file.filename or "resume"
    content = await file.read()
    if len(content) > MAX_RESUME_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume file is too large. Maximum size is 5MB.",
        )

    text = _extract_text(filename, content)
    projects = await _extract_projects_with_ai(text, openai_api_key, openai_model, language)

    await db.execute(delete(models.Resume).where(models.Resume.user_id == user_id))
    resume = models.Resume(
        user_id=user_id,
        filename=filename,
        content_text=text,
        projects_json=projects,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    return UploadResumeResponse(
        resume=_resume_to_resource(resume),
        message="Resume uploaded and parsed.",
    )


@router.delete("/current")
async def delete_current_resume(
    user_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(models.Resume).where(models.Resume.user_id == user_id))
    await db.commit()
    return {"message": "Resume deleted."}
