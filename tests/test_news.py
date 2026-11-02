import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import fetch_news  # noqa: E402

RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<item><title>2028 대입 수시 확대 - 연합뉴스</title><link>https://news.google.com/rss/articles/a</link>
<pubDate>Sun, 01 Nov 2026 01:00:00 GMT</pubDate><source url="https://www.yna.co.kr">연합뉴스</source></item>
<item><title>안정적인 수능 시행 지원 - 전체 | 카드/한컷 | 멀티미디어 - 대한민국 정책브리핑</title><link>https://news.google.com/rss/articles/b</link>
<pubDate>Sat, 31 Oct 2026 02:29:00 GMT</pubDate><source url="https://www.korea.kr">대한민국 정책브리핑</source></item>
<item><title>에너지 현안에 대응중입니다 - 대한민국 정책브리핑</title><link>https://news.google.com/rss/articles/c</link>
<pubDate>Sat, 31 Oct 2026 02:29:00 GMT</pubDate><source url="https://www.korea.kr">대한민국 정책브리핑</source></item>
<item><title>오래된 수능 기사 - 뉴시스</title><link>https://news.google.com/rss/articles/d</link>
<pubDate>Mon, 01 Jun 2026 01:00:00 GMT</pubDate><source url="https://www.newsis.com">뉴시스</source></item>
</channel></rss>""".encode()

NOW = datetime(2026, 11, 2, tzinfo=timezone.utc)


class ParseTest(unittest.TestCase):
    def setUp(self):
        self.items = fetch_news.parse(RSS, NOW)

    def test_keeps_relevant_recent_items_only(self):
        titles = [i["title"] for i in self.items]
        self.assertEqual(titles, ["2028 대입 수시 확대", "안정적인 수능 시행 지원"])

    def test_official_flag_and_tags(self):
        by = {i["title"]: i for i in self.items}
        self.assertFalse(by["2028 대입 수시 확대"]["official"])
        self.assertTrue(by["안정적인 수능 시행 지원"]["official"])
        self.assertEqual(by["2028 대입 수시 확대"]["tags"], ["대입"])
        self.assertEqual(by["2028 대입 수시 확대"]["publishedAt"], "2026-11-01T10:00+09:00")

    def test_is_official(self):
        self.assertTrue(fetch_news.is_official("https://www.korea.kr"))
        self.assertTrue(fetch_news.is_official("https://www.sen.go.kr/x"))
        self.assertFalse(fetch_news.is_official("https://www.yna.co.kr"))
        self.assertFalse(fetch_news.is_official("https://fakekorea.kr"))


if __name__ == "__main__":
    unittest.main()
