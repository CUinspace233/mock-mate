from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, update

from api.endpoints import answers, questions, sessions, trending, user
from database.models import Base, Question
from database.session import AsyncSessionLocal, engine
from scheduler import start_scheduler

scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Add new columns to existing tables (SQLite ALTER TABLE)
        # create_all only creates new tables, not new columns on existing ones.
        for col_sql in [
            "ALTER TABLE questions ADD COLUMN status VARCHAR(20) DEFAULT 'completed'",
            "ALTER TABLE questions ADD COLUMN session_id VARCHAR REFERENCES interview_sessions(id)",
        ]:
            try:
                await conn.execute(text(col_sql))
            except Exception:
                pass  # Column already exists

    # Mark any questions stuck in "generating" (from a previous crash) as interrupted
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Question).where(Question.status == "generating").values(status="interrupted")
        )
        await db.commit()

    scheduler = start_scheduler()
    print("🚀 News scheduler started!")

    yield

    if scheduler:
        scheduler.shutdown()


app = FastAPI(
    title="MockMate API",
    description="Interview practice platform API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(user.router, prefix="/api/users", tags=["Users"])
app.include_router(questions.router, prefix="/api/questions", tags=["Questions"])
app.include_router(answers.router, prefix="/api/answers", tags=["Answers"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(trending.router, prefix="/api/trending", tags=["Trending Questions"])


@app.get("/")
async def root():
    return {"message": "MockMate API is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}
