#!/usr/bin/env python3
"""
Standalone script to clean up expired news data from the database.

Usage:
    python cleanup_news.py              # Use default retention (30 days)
    python cleanup_news.py --days 7     # Override retention to 7 days
    python cleanup_news.py --dry-run    # Preview what would be deleted
"""

import argparse
import asyncio
import sys
import os

# Ensure backend directory is on the path so imports work when run from anywhere
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, UTC, timedelta
from sqlalchemy import select, delete, text, func
from database.session import engine, AsyncSessionLocal
from database import models
from utility.settings import settings


async def preview_cleanup(retention_days: int) -> None:
    """Show what would be deleted without actually deleting."""
    cutoff_date = datetime.now(UTC) - timedelta(days=retention_days)

    async with AsyncSessionLocal() as db:
        news_count = await db.scalar(
            select(func.count()).select_from(models.NewsItem).where(
                models.NewsItem.published_at < cutoff_date
            )
        )
        nbq_count = await db.scalar(
            select(func.count())
            .select_from(models.NewsBasedQuestion)
            .join(models.NewsItem, models.NewsBasedQuestion.news_item_id == models.NewsItem.id)
            .where(models.NewsItem.published_at < cutoff_date)
        )

        total_news = await db.scalar(select(func.count()).select_from(models.NewsItem))
        total_nbq = await db.scalar(select(func.count()).select_from(models.NewsBasedQuestion))
        total_q = await db.scalar(select(func.count()).select_from(models.Question))

        db_path = settings.database_url.split("///")[-1]
        resolved = os.path.join(os.path.dirname(os.path.abspath(__file__)), db_path)
        db_size = os.path.getsize(resolved) / (1024 * 1024) if os.path.exists(resolved) else 0

    print(f"\n--- Dry Run (retention={retention_days} days, cutoff={cutoff_date.date()}) ---")
    print(f"Database size:          {db_size:.2f} MB")
    print(f"Total NewsItems:        {total_news}")
    print(f"Total NewsBasedQuestions:{total_nbq}")
    print(f"Total Questions:        {total_q}")
    print(f"NewsItems to delete:    {news_count}")
    print(f"NewsBasedQuestions to delete: {nbq_count}")
    print("(Associated Questions will also be deleted unless used in InterviewRecords)")
    print("---")


async def run_cleanup(retention_days: int) -> None:
    """Execute the cleanup."""
    cutoff_date = datetime.now(UTC) - timedelta(days=retention_days)

    async with AsyncSessionLocal() as db:
        # 1. Find expired NewsBasedQuestion IDs and their linked question_ids
        expired_nbq_stmt = (
            select(models.NewsBasedQuestion.id, models.NewsBasedQuestion.question_id)
            .join(models.NewsItem, models.NewsBasedQuestion.news_item_id == models.NewsItem.id)
            .where(models.NewsItem.published_at < cutoff_date)
        )
        expired_rows = (await db.execute(expired_nbq_stmt)).all()

        expired_nbq_ids = [row[0] for row in expired_rows]
        expired_question_ids = [row[1] for row in expired_rows]

        # 2. Delete expired NewsBasedQuestion records
        deleted_nbq = 0
        if expired_nbq_ids:
            result = await db.execute(
                delete(models.NewsBasedQuestion).where(
                    models.NewsBasedQuestion.id.in_(expired_nbq_ids)
                )
            )
            deleted_nbq = result.rowcount

        # 3. Delete associated Question records (skip those used in InterviewRecords)
        deleted_questions = 0
        if expired_question_ids:
            used_q_stmt = select(models.InterviewRecord.question_id).where(
                models.InterviewRecord.question_id.in_(expired_question_ids)
            )
            used_question_ids = {row[0] for row in (await db.execute(used_q_stmt)).all()}

            safe_to_delete = [qid for qid in expired_question_ids if qid not in used_question_ids]
            if safe_to_delete:
                result = await db.execute(
                    delete(models.Question).where(models.Question.id.in_(safe_to_delete))
                )
                deleted_questions = result.rowcount

        # 4. Delete expired NewsItem records
        result = await db.execute(
            delete(models.NewsItem).where(models.NewsItem.published_at < cutoff_date)
        )
        deleted_news = result.rowcount

        await db.commit()

    # 5. VACUUM outside transaction
    async with engine.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        await conn.execute(text("VACUUM"))

    print(f"\nCleanup complete (retention={retention_days} days, cutoff={cutoff_date.date()}):")
    print(f"  Deleted {deleted_news} news items")
    print(f"  Deleted {deleted_nbq} news-based questions")
    print(f"  Deleted {deleted_questions} questions")


def main():
    parser = argparse.ArgumentParser(description="Clean up expired news data from MockMate database")
    parser.add_argument(
        "--days", type=int, default=settings.news_retention_days,
        help=f"Retention period in days (default: {settings.news_retention_days})",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview what would be deleted without making changes",
    )
    args = parser.parse_args()

    if args.dry_run:
        asyncio.run(preview_cleanup(args.days))
    else:
        asyncio.run(run_cleanup(args.days))


if __name__ == "__main__":
    main()
