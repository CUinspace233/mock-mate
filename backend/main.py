from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.endpoints import user, questions, answers, sessions
from database.models import Base
from database.session import engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Mock Mate API",
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


@app.get("/")
async def root():
    return {"message": "Mock Mate API is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}
