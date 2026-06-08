import unittest
from datetime import UTC, datetime, timedelta

from api.endpoints.trending import (
    RELEVANCE_THRESHOLD,
    _count_keyword_hits,
    calculate_relevance_score,
)
from database.schemas import NewsCategory


class CountKeywordHitsTests(unittest.TestCase):
    def test_counts_matching_keywords(self):
        text = "react and javascript frameworks"
        keywords = ["react", "vue", "javascript"]
        self.assertEqual(_count_keyword_hits(text, keywords), 2)

    def test_returns_zero_when_no_matches(self):
        self.assertEqual(_count_keyword_hits("hello world", ["react"]), 0)


class CalculateRelevanceScoreTests(unittest.TestCase):
    def setUp(self):
        # Align with calculate_relevance_score, which measures recency against datetime.now(UTC).
        self.now = datetime.now(UTC)
        self.news_item = {
            "title": "React 19 release brings new compiler optimizations",
            "summary": "Frontend teams are evaluating JavaScript migration paths.",
            "published_at": self.now,
        }

    def test_empty_question_returns_zero(self):
        score = calculate_relevance_score(self.news_item, "   ", NewsCategory.WEB_DEV, "frontend")
        self.assertEqual(score, 0.0)

    def test_strong_match_meets_threshold(self):
        question = "How would you migrate a large React application to React 19?"
        score = calculate_relevance_score(
            self.news_item, question, NewsCategory.WEB_DEV, "frontend"
        )
        self.assertGreaterEqual(score, RELEVANCE_THRESHOLD)

    def test_unrelated_position_stays_below_threshold(self):
        question = "How would you design a Kubernetes deployment pipeline?"
        score = calculate_relevance_score(self.news_item, question, NewsCategory.WEB_DEV, "devops")
        self.assertLess(score, RELEVANCE_THRESHOLD)

    def test_no_base_floor_without_signals(self):
        unrelated_news = {
            "title": "Company picnic photos from summer 2024",
            "summary": "Employees enjoyed food and games.",
            "published_at": self.now - timedelta(days=30),
        }
        question = "Tell me about a challenging project."
        # frontend is not aligned with DEVOPS category and has no keyword overlap
        score = calculate_relevance_score(unrelated_news, question, NewsCategory.DEVOPS, "frontend")
        self.assertLess(score, RELEVANCE_THRESHOLD)
        self.assertEqual(score, 0.0)

    def test_recency_bonus_within_one_day(self):
        question = "What is your React experience?"
        fresh = calculate_relevance_score(
            self.news_item, question, NewsCategory.WEB_DEV, "frontend"
        )
        stale_item = {**self.news_item, "published_at": self.now - timedelta(days=30)}
        stale = calculate_relevance_score(stale_item, question, NewsCategory.WEB_DEV, "frontend")
        self.assertGreater(fresh, stale)

    def test_recency_tiers(self):
        question = "How do you evaluate new JavaScript frameworks?"
        within_one_day = calculate_relevance_score(
            self.news_item, question, NewsCategory.WEB_DEV, "frontend"
        )
        within_three_days = calculate_relevance_score(
            {**self.news_item, "published_at": self.now - timedelta(days=2)},
            question,
            NewsCategory.WEB_DEV,
            "frontend",
        )
        within_seven_days = calculate_relevance_score(
            {**self.news_item, "published_at": self.now - timedelta(days=5)},
            question,
            NewsCategory.WEB_DEV,
            "frontend",
        )
        self.assertGreater(within_one_day, within_three_days)
        self.assertGreater(within_three_days, within_seven_days)

    def test_score_is_capped_at_one(self):
        heavy_news = {
            "title": "React Vue Angular JavaScript CSS HTML UI UX frontend",
            "summary": "web development full stack frontend backend javascript react vue",
            "published_at": self.now,
        }
        question = (
            "How do React, Vue, Angular, JavaScript, CSS, HTML, UI, and UX "
            "shape your frontend architecture?"
        )
        score = calculate_relevance_score(heavy_news, question, NewsCategory.WEB_DEV, "frontend")
        self.assertEqual(score, 1.0)

    def test_category_alignment_adds_points(self):
        question = "How do you stay current with industry trends?"
        minimal_news = {
            "title": "Industry trends",
            "summary": "",
            "published_at": self.now,
        }
        aligned = calculate_relevance_score(
            minimal_news, question, NewsCategory.WEB_DEV, "frontend"
        )
        misaligned = calculate_relevance_score(
            minimal_news, question, NewsCategory.DEVOPS, "frontend"
        )
        self.assertGreater(aligned, misaligned)
        self.assertAlmostEqual(aligned - misaligned, 0.15)

    def test_question_keywords_contribute_independently(self):
        news_without_keywords = {
            "title": "Weekly engineering roundup",
            "summary": "Teams shared updates from across the organization.",
            "published_at": self.now,
        }
        generic_question = "How do you stay current with industry trends?"
        targeted_question = "How would you evaluate React for a new frontend project?"

        generic_score = calculate_relevance_score(
            news_without_keywords,
            generic_question,
            NewsCategory.WEB_DEV,
            "frontend",
        )
        targeted_score = calculate_relevance_score(
            news_without_keywords,
            targeted_question,
            NewsCategory.WEB_DEV,
            "frontend",
        )
        self.assertGreater(targeted_score, generic_score)


if __name__ == "__main__":
    unittest.main()
