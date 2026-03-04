from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from utility.settings import settings

engine = create_async_engine(settings.database_url, echo=settings.database_echo)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
