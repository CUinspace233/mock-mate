from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from database import models
from api.deps import get_db
from datetime import datetime, UTC, timedelta
from openai import OpenAI
import feedparser  # type: ignore
import logging
from database.schemas import (
    NewsSourceType,
    NewsCategory,
    QuestionType,
    NewsSourceOut,
    TrendingQuestionResponse,
    FetchNewsRequest,
    FetchNewsResponse,
    GetTrendingQuestionsRequest,
    GetTrendingQuestionsResponse,
    GeneratedQuestion,
)
import requests  # type: ignore

router = APIRouter()
client = OpenAI()
logger = logging.getLogger(__name__)

# Predefined news sources
NEWS_SOURCES = {
    NewsCategory.AI: [
        {
            "name": "Google News - AI Technology",
            "url": "https://news.google.com/rss/search?q=AI+technology+artificial+intelligence&hl=en",
            "type": NewsSourceType.RSS,
        },
        {
            "name": "Hacker News - AI",
            "url": "https://hn.algolia.com/api/v1/search?tags=story&query=AI",
            "type": NewsSourceType.API,
        },
    ],
    NewsCategory.WEB_DEV: [
        {
            "name": "Google News - Web Development",
            "url": "https://news.google.com/rss/search?q=web+development+javascript+react+vue&hl=en",
            "type": NewsSourceType.RSS,
        }
    ],
    NewsCategory.MOBILE: [
        {
            "name": "Google News - Mobile Development",
            "url": "https://news.google.com/rss/search?q=mobile+development+react+native+flutter&hl=en",
            "type": NewsSourceType.RSS,
        }
    ],
    NewsCategory.DEVOPS: [
        {
            "name": "Google News - DevOps",
            "url": "https://news.google.com/rss/search?q=devops+docker+kubernetes+cloud&hl=en",
            "type": NewsSourceType.RSS,
        }
    ],
}


async def fetch_rss_news(url: str, limit: int = 10) -> list[dict]:
    """Fetch news from RSS feed with User-Agent header"""
    try:
        logger.info(f"🔍 Fetching RSS from: {url}")
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=10)
        feed = feedparser.parse(resp.content)

        if not feed.entries:
            logger.warning(f"⚠️ No entries found in RSS feed: {url}")
            return []

        logger.info(f"✅ Found {len(feed.entries)} entries in RSS feed")
        news_items = []

        for entry in feed.entries[:limit]:
            # Parse published date
            published_at = datetime.now(UTC)
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                import time

                published_at = datetime.fromtimestamp(time.mktime(entry.published_parsed), UTC)

            news_item = {
                "title": entry.title,
                "summary": getattr(entry, "summary", "")[:1000],
                "url": entry.link,
                "published_at": published_at,
                "content": getattr(entry, "description", "")[:2000],
            }

            logger.info(f"📰 News item: {news_item['title'][:50]}...")
            news_items.append(news_item)

        return news_items
    except Exception as e:
        logger.error(f"❌ Error fetching RSS news from {url}: {str(e)}")
        return []


async def generate_question_from_news(
    news_item: dict, position: str, category: NewsCategory
) -> tuple[GeneratedQuestion | None, str, float]:
    """Generate interview question from news item using AI"""
    try:
        logger.info(f"🤖 Generating question for {position} from: {news_item['title'][:50]}...")

        if not news_item.get("title") or len(news_item.get("title", "")) < 10:
            logger.warning(f"⚠️ News title too short, skipping: {news_item.get('title', '')}")
            return None, "", 0.0

        # Create prompt based on category and position
        category_context = {
            NewsCategory.AI: "artificial intelligence, machine learning, or AI technology",
            NewsCategory.WEB_DEV: "web development, frontend/backend technologies, or web frameworks",
            NewsCategory.MOBILE: "mobile app development, React Native, Flutter, or mobile technologies",
            NewsCategory.DEVOPS: "DevOps, cloud infrastructure, containers, or deployment technologies",
            NewsCategory.GENERAL_TECH: "technology or software development",
        }

        context = category_context.get(category, "technology")

        prompt = f"""
        Based on the following recent news about {context}, generate a thoughtful interview question 
        for a {position} developer position. The question should be relevant to current industry trends 
        and encourage the candidate to share their perspective or technical understanding.

        News Title: {news_item['title']}
        News Summary: {news_item['summary']}

        Generate a question that:
        1. Is relevant to a {position} developer role
        2. Encourages critical thinking about current industry trends
        3. Can be answered based on the candidate's experience and opinion
        4. Is professional and appropriate for an interview setting

        Also provide a brief reasoning (1-2 sentences) for why this question is relevant.

        Format your response as:
        QUESTION: [your question here]
        REASONING: [your reasoning here]
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert technical interviewer who creates insightful questions based on current industry news and trends.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=300,
            temperature=0.7,
        )

        content = (response.choices[0].message.content or "").strip()
        logger.info(f"🎯 AI Response: {content[:100]}...")

        # Parse the response
        lines = content.split("\n")
        question_content = ""
        ai_reasoning = ""

        for line in lines:
            if line.startswith("QUESTION:"):
                question_content = line.replace("QUESTION:", "").strip()
            elif line.startswith("REASONING:"):
                ai_reasoning = line.replace("REASONING:", "").strip()

        if not question_content:
            # Fallback parsing
            question_content = content.split("QUESTION:")[-1].split("REASONING:")[0].strip()
            ai_reasoning = (
                content.split("REASONING:")[-1].strip() if "REASONING:" in content else ""
            )

        # Calculate relevance score based on keywords and content quality
        relevance_score = calculate_relevance_score(news_item, question_content, category, position)

        # Determine question type
        question_type = determine_question_type(question_content)

        generated_question = GeneratedQuestion(
            question_type=question_type,
            content=question_content,
            position=position,
            difficulty="medium",
            expected_keywords=["current trends", "industry insight", "technical opinion"],
        )

        if question_content:
            logger.info(f"✅ Generated question: {question_content[:50]}...")
            logger.info(f"📊 Relevance score: {relevance_score}")
        else:
            logger.warning(f"⚠️ Failed to parse question from AI response: {content}")

        return generated_question, ai_reasoning, relevance_score

    except Exception as e:
        logger.error(f"❌ Error generating question from news: {str(e)}")
        return None, "", 0.0


def calculate_relevance_score(
    news_item: dict, question: str, category: NewsCategory, position: str
) -> float:
    """Calculate relevance score based on various factors"""
    score = 0.5  # Base score

    # Check for position-related keywords
    position_keywords = {
        "frontend": ["react", "vue", "angular", "javascript", "css", "html", "ui", "ux"],
        "backend": ["api", "database", "server", "python", "java", "node", "sql"],
        "fullstack": ["full stack", "frontend", "backend", "web development"],
        "mobile": ["mobile", "ios", "android", "react native", "flutter", "app"],
        "devops": ["docker", "kubernetes", "aws", "cloud", "deployment", "ci/cd"],
    }

    keywords = position_keywords.get(position, [])
    title_lower = news_item["title"].lower()
    summary_lower = (news_item.get("summary", "")).lower()

    # Increase score for relevant keywords
    for keyword in keywords:
        if keyword in title_lower or keyword in summary_lower:
            score += 0.1

    # Check recency (newer news gets higher score)
    news_date = news_item.get("published_at", datetime.now(UTC))
    days_old = (datetime.now(UTC) - news_date).days
    if days_old <= 1:
        score += 0.2
    elif days_old <= 3:
        score += 0.1

    # Ensure score is between 0 and 1
    return min(1.0, max(0.0, score))


def determine_question_type(question: str) -> QuestionType:
    """Determine question type based on content"""
    question_lower = question.lower()

    if any(
        word in question_lower
        for word in ["how would you", "what do you think", "your opinion", "perspective"]
    ):
        return QuestionType.OPINION
    elif any(
        word in question_lower
        for word in ["implement", "design", "architecture", "technical", "code"]
    ):
        return QuestionType.TECHNICAL
    else:
        return QuestionType.BEHAVIORAL


@router.post("/fetch-news", response_model=FetchNewsResponse)
async def fetch_latest_news(
    request: FetchNewsRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)
):
    """Manually trigger news fetching and question generation"""
    try:
        # Add background task for news processing
        background_tasks.add_task(
            process_news_and_generate_questions, db, request.category, request.limit
        )

        return FetchNewsResponse(
            news_items=[],
            questions_generated=0,
            message="News fetching started in background. Questions will be generated shortly.",
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch news: {str(e)}",
        )


async def process_news_and_generate_questions(
    db: AsyncSession, category: NewsCategory | None = None, limit: int = 10
):
    """Background task to process news and generate questions"""
    try:
        categories_to_process = [category] if category else list(NewsCategory)
        total_questions = 0

        for cat in categories_to_process:
            sources = NEWS_SOURCES.get(cat, [])

            for source_config in sources:
                # Check if news source exists, create if not
                source_stmt = select(models.NewsSource).where(
                    and_(
                        models.NewsSource.url == source_config["url"],
                        models.NewsSource.category == cat.value,
                    )
                )
                source_result = await db.execute(source_stmt)
                source = source_result.scalar_one_or_none()

                if not source:
                    source = models.NewsSource(
                        name=source_config["name"],
                        source_type=source_config["type"],
                        url=source_config["url"],
                        category=cat.value,
                        is_active=True,
                    )
                    db.add(source)
                    await db.commit()
                    await db.refresh(source)

                # Fetch news items
                if source_config["type"] == NewsSourceType.RSS:
                    news_items = await fetch_rss_news(source_config["url"], limit)

                    for news_data in news_items:
                        # Check if news item already exists
                        existing_stmt = select(models.NewsItem).where(
                            models.NewsItem.url == news_data["url"]
                        )
                        existing_result = await db.execute(existing_stmt)
                        existing_item = existing_result.scalar_one_or_none()

                        if existing_item:
                            continue  # Skip if already processed

                        # Create news item
                        news_item = models.NewsItem(
                            source_id=source.id,
                            title=news_data["title"],
                            summary=news_data["summary"],
                            content=news_data.get("content", ""),
                            url=news_data["url"],
                            published_at=news_data["published_at"],
                            category=cat.value,
                            is_processed=False,
                        )
                        db.add(news_item)
                        await db.commit()
                        await db.refresh(news_item)

                        # Generate questions for different positions
                        positions = ["frontend", "backend", "fullstack", "mobile", "devops"]

                        for position in positions:
                            question_data, ai_reasoning, relevance_score = (
                                await generate_question_from_news(news_data, position, cat)
                            )

                            if (
                                question_data and relevance_score > 0.3
                            ):  # Only save relevant questions
                                # Create the base question
                                question = models.Question(
                                    content=question_data.content,
                                    position=question_data.position,
                                    difficulty=question_data.difficulty,
                                    question_type=question_data.question_type.value,
                                    expected_keywords=question_data.expected_keywords,
                                )
                                db.add(question)
                                await db.commit()
                                await db.refresh(question)

                                # Create the news-based question relationship
                                news_based_question = models.NewsBasedQuestion(
                                    news_item_id=news_item.id,
                                    question_id=question.id,
                                    relevance_score=relevance_score,
                                    question_type=determine_question_type(
                                        question_data.content
                                    ).value,
                                    ai_reasoning=ai_reasoning,
                                )
                                db.add(news_based_question)
                                total_questions += 1

                        # Mark news item as processed
                        news_item.is_processed = True
                        await db.commit()

                # Update source last_fetched timestamp
                source.last_fetched = datetime.now(UTC)
                await db.commit()

        logger.info(f"Generated {total_questions} questions from latest news")

    except Exception as e:
        logger.error(f"Error in background news processing: {str(e)}")
        await db.rollback()


@router.get("/trending-questions", response_model=GetTrendingQuestionsResponse)
async def get_trending_questions(
    request: GetTrendingQuestionsRequest = Depends(), db: AsyncSession = Depends(get_db)
):
    """Get trending interview questions based on recent news"""
    try:
        # Calculate date range
        cutoff_date = datetime.now(UTC) - timedelta(days=request.days_back)

        # Build query
        query = (
            select(models.NewsBasedQuestion, models.Question, models.NewsItem, models.NewsSource)
            .join(models.Question, models.NewsBasedQuestion.question_id == models.Question.id)
            .join(models.NewsItem, models.NewsBasedQuestion.news_item_id == models.NewsItem.id)
            .join(models.NewsSource, models.NewsItem.source_id == models.NewsSource.id)
            .where(models.NewsItem.published_at >= cutoff_date)
        )

        # Apply filters
        if request.position:
            query = query.where(models.Question.position == request.position.value)

        if request.category:
            query = query.where(models.NewsItem.category == request.category.value)

        # Order by relevance score and recency
        query = query.order_by(
            desc(models.NewsBasedQuestion.relevance_score), desc(models.NewsItem.published_at)
        ).limit(request.limit)

        result = await db.execute(query)
        rows = result.fetchall()

        # Format response
        trending_questions = []
        for news_based_q, question, news_item, news_source in rows:
            trending_questions.append(
                TrendingQuestionResponse(
                    id=news_based_q.id,
                    content=question.content,
                    position=question.position,
                    difficulty=question.difficulty,
                    question_type=QuestionType(news_based_q.question_type),
                    source_title=news_item.title,
                    source_url=news_item.url,
                    published_at=news_item.published_at,
                    relevance_score=news_based_q.relevance_score,
                    ai_reasoning=news_based_q.ai_reasoning,
                    created_at=news_based_q.created_at,
                )
            )

        return GetTrendingQuestionsResponse(
            questions=trending_questions, total_count=len(trending_questions)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get trending questions: {str(e)}",
        )


@router.get("/news-sources", response_model=list[NewsSourceOut])
async def get_news_sources(db: AsyncSession = Depends(get_db)):
    """Get all configured news sources"""
    try:
        stmt = select(models.NewsSource).where(models.NewsSource.is_active)
        result = await db.execute(stmt)
        sources = result.scalars().all()
        return sources

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get news sources: {str(e)}",
        )


# Scheduled task endpoint (for cron jobs or external schedulers)
@router.post("/scheduled-fetch")
async def scheduled_news_fetch(
    background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)
):
    """Endpoint for scheduled news fetching (to be called by cron job every 4 hours)"""
    try:
        background_tasks.add_task(process_news_and_generate_questions, db, None, 5)
        return {"message": "Scheduled news fetch started", "timestamp": datetime.now(UTC)}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start scheduled fetch: {str(e)}",
        )
