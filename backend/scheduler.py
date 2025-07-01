from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore
from apscheduler.triggers.interval import IntervalTrigger  # type: ignore
from api.deps import get_db
from api.endpoints.trending import process_news_and_generate_questions


async def fetch_news_task():
    """directly call the database function, not through HTTP"""
    async for db in get_db():
        try:
            await process_news_and_generate_questions(db, None, 5)
            print("✅ News fetch task completed")
        except Exception as e:
            print(f"❌ News fetch task failed: {e}")
        finally:
            await db.close()


def start_scheduler():
    scheduler = AsyncIOScheduler()
    # uncomment below to run once immediately

    import asyncio
    asyncio.create_task(fetch_news_task())

    # then run every 4 hours
    scheduler.add_job(fetch_news_task, trigger=IntervalTrigger(hours=4), id="news_fetch_job")
    scheduler.start()
    return scheduler
