import feedparser  # type: ignore
import asyncio
import requests  # type: ignore


async def test_rss():
    url = "https://news.google.com/rss/search?q=AI+technology&hl=en"
    print(f"Testing RSS: {url}")

    feed = fetch_rss_with_headers(url)
    print(f"Found {len(feed.entries)} entries")

    for i, entry in enumerate(feed.entries[:3]):
        print(f"\n--- Entry {i+1} ---")
        print(f"Title: {entry.title}")
        print(f"Link: {entry.link}")
        print(f"Summary: {getattr(entry, 'summary', 'No summary')[:100]}...")


def fetch_rss_with_headers(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
    }
    resp = requests.get(url, headers=headers, timeout=10)
    return feedparser.parse(resp.content)


if __name__ == "__main__":
    asyncio.run(test_rss())
