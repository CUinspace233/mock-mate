from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore
from apscheduler.triggers.interval import IntervalTrigger  # type: ignore
from api.deps import get_db
from api.endpoints.trending import process_news_and_generate_questions
from datetime import datetime, UTC, timedelta
from database import models
from sqlalchemy import select, desc


async def fetch_news_task():
    """Check if task ran recently before executing news fetch"""
    async for db in get_db():
        try:
            # Check if any news source was fetched in the last 4 hours
            four_hours_ago = datetime.now(UTC) - timedelta(hours=4)

            recent_fetch_stmt = (
                select(models.NewsSource)
                .where(models.NewsSource.last_fetched >= four_hours_ago)
                .order_by(desc(models.NewsSource.last_fetched))
                .limit(1)
            )

            result = await db.execute(recent_fetch_stmt)
            recent_source = result.scalar_one_or_none()

            if recent_source:
                last_fetch_time = recent_source.last_fetched
                time_since_last = datetime.now(UTC) - last_fetch_time
                hours_since = time_since_last.total_seconds() / 3600

                print(f"⏭️ News was fetched {hours_since:.1f} hours ago, skipping this run")
                return

            print("🚀 Starting news fetch task...")
            await process_news_and_generate_questions(db, None, 5)
            print("✅ News fetch task completed")

        except Exception as e:
            print(f"❌ News fetch task failed: {e}")
        finally:
            await db.close()


def start_scheduler():
    scheduler = AsyncIOScheduler(
        job_defaults={
            "max_instances": 1,  # Prevent overlapping jobs
            "coalesce": True,  # Merge queued jobs if multiple are pending
            "misfire_grace_time": 60,  # Grace time for missed executions
        }
    )

    # Schedule to run immediately once, then every 4 hours
    scheduler.add_job(
        fetch_news_task,
        trigger=IntervalTrigger(hours=4),
        id="news_fetch_job",
        next_run_time=datetime.now(UTC),  # Run immediately on startup
    )
    scheduler.start()
    return scheduler
