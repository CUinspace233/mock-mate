from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.endpoints import user, questions, answers, sessions, trending
from database.models import Base
from database.session import engine
from scheduler import start_scheduler

scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

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
