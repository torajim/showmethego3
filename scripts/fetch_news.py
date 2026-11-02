"""입시 뉴스 수집: Google 뉴스 RSS에서 입시 관련 기사를 모아 data/news.json에 저장한다.

- 표준 라이브러리만 사용한다.
- 기사 제목, 언론사, 발행 시각, 원문 링크만 저장한다(본문은 저장하지 않음).
- 정부·교육청·평가원·대교협 등 공식 기관 출처는 official=true로 표시한다.
- 수집이 전부 실패하면 기존 파일을 그대로 두고 종료한다(사이트에서 뉴스가 사라지지 않도록).

사용법:
    python scripts/fetch_news.py            # data/news.json 갱신
    python scripts/fetch_news.py --dry-run  # 결과만 출력
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "news.json"

WINDOW_DAYS = 30
MAX_ITEMS = 60
KST = timezone(timedelta(hours=9))

QUERIES = [
    "대입 전형",
    "수능 평가원",
    "고교학점제",
    "내신 5등급",
    "고입 자사고 외고 과학고",
    "의대 정원 지역인재",
    "교육부 대입",
    # 서비스 지역(서울·경기) 소식
    "서울시교육청 고입",
    "서울 중학교 배정",
    "경기도교육청 고입",
    "경기 고교 평준화",
    # 공식 발표(대한민국 정책브리핑에 실린 교육부·교육청 보도자료)
    "site:korea.kr 수능",
    "site:korea.kr 대입",
    "site:korea.kr 고교학점제",
    "site:korea.kr 의대",
    "site:korea.kr 내신",
]

# 공식 기관 도메인(정부, 교육청, 평가원, 대교협, 교육부 산하기관)
OFFICIAL_DOMAINS = (
    "korea.kr",
    "moe.go.kr",
    "kice.re.kr",
    "kcue.or.kr",
    "adiga.kr",
    "sen.go.kr",
    "goe.go.kr",
    "ebs.co.kr/ebs/ent",
    "kedi.re.kr",
    "nec.go.kr",
)

# 태그: (표시 이름, 단계, 키워드들)
TAGS: list[tuple[str, str, tuple[str, ...]]] = [
    ("수능", "university", ("수능", "수학능력시험", "평가원", "모의평가")),
    ("대입", "university", ("대입", "수시", "정시", "입학전형", "학생부종합", "논술", "원서")),
    ("의약학", "university", ("의대", "의과대", "지역의사", "약대", "치대", "한의대")),
    ("지역인재", "university", ("지역인재",)),
    ("내신", "high", ("내신", "5등급", "성취평가", "상대평가", "절대평가")),
    ("고교학점제", "high", ("고교학점제", "학점제", "선택과목")),
    ("고입", "middle", ("고입", "자사고", "외고", "국제고", "과학고", "영재학교", "특목고", "일반고 배정", "평준화")),
    ("중학교", "middle", ("중학교 배정", "중학교 입학", "중학생")),
]

# 지역 판별용 지명. 다른 시·도에도 있는 이름(중구, 동구, 강서구 등)은 넣지 않는다.
SEOUL_PLACES = (
    "서울", "종로", "용산구", "성동구", "광진구", "동대문", "중랑구", "성북구", "강북구", "도봉구", "노원구",
    "은평구", "서대문", "마포구", "양천구", "구로구", "금천구", "영등포", "동작구", "관악구", "서초구",
    "강남구", "송파구", "강동구", "대치동", "목동",
)
GYEONGGI_PLACES = (
    "경기", "수원", "성남", "분당", "용인", "고양", "일산", "부천", "안산", "안양", "과천", "군포", "의왕",
    "광명", "의정부", "화성", "동탄", "평택", "시흥", "파주", "김포", "남양주", "하남", "구리", "오산",
    "이천", "안성", "양주", "포천", "동두천", "여주", "가평", "양평", "연천",
)
OTHER_PLACES = (
    "부산", "대구", "인천", "광주광역", "광주시교육청", "대전", "울산", "세종", "강원", "충북", "충남", "충청",
    "전북", "전남", "전라", "경북", "경남", "경상", "제주", "창원", "청주", "천안", "전주", "포항",
)

RELEVANT = tuple(k for _, _, keys in TAGS for k in keys)
TITLE_SUFFIX = re.compile(r"\s+-\s+[^-]+$")


def rss_url(query: str) -> str:
    q = urllib.parse.quote(f"{query} when:{WINDOW_DAYS}d")
    return f"https://news.google.com/rss/search?q={q}&hl=ko&gl=KR&ceid=KR:ko"


def fetch(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "showmethego3-news/1.0 (+https://torajim.github.io/showmethego3/)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def is_official(publisher_url: str) -> bool:
    host = urllib.parse.urlparse(publisher_url).netloc.lower()
    full = host + urllib.parse.urlparse(publisher_url).path
    return any(host == d or host.endswith("." + d) or full.startswith(d) for d in OFFICIAL_DOMAINS)


def clean_title(title: str, publisher: str) -> str:
    t = title.strip()
    # Google 뉴스는 제목 끝에 " - 언론사"를 붙인다. 여러 번 붙는 경우도 있다.
    while publisher and t.endswith(f" - {publisher}"):
        t = t[: -len(f" - {publisher}")].rstrip()
    return t


def tag(title: str) -> tuple[list[str], list[str]]:
    tags, stages = [], []
    for name, stage, keys in TAGS:
        if any(k in title for k in keys):
            tags.append(name)
            if stage not in stages:
                stages.append(stage)
    return tags, stages


def places(title: str) -> tuple[list[str], list[str]]:
    """제목에 나온 지역 코드(seoul/gyeonggi/other)와 서울·경기 지명."""
    regions: list[str] = []
    found: list[str] = []
    for code, names in (("seoul", SEOUL_PLACES), ("gyeonggi", GYEONGGI_PLACES)):
        hit = [n for n in names if n in title]
        if hit:
            regions.append(code)
            found += hit
    # "경기도"가 아니라 "경기 침체" 같은 일반 명사로 쓰인 경우를 줄이기 위해 교육 맥락 지명이 함께 있을 때만 인정
    if "gyeonggi" in regions and found == ["경기"] and not any(k in title for k in ("경기도", "경기교육", "경기 교육", "경기 고", "경기 중")):
        regions.remove("gyeonggi")
        found = []
    if any(n in title for n in OTHER_PLACES):
        regions.append("other")
    return regions, found


def parse(xml_bytes: bytes, now: datetime) -> list[dict]:
    items = []
    root = ET.fromstring(xml_bytes)
    for it in root.iter("item"):
        src = it.find("source")
        publisher = (src.text or "").strip() if src is not None else ""
        publisher_url = src.get("url", "") if src is not None else ""
        title = clean_title(it.findtext("title") or "", publisher)
        # 정책브리핑 멀티미디어 등은 " - 전체 | 카드/한컷 | ..." 같은 꼬리가 붙는다.
        title = re.sub(r"\s+-\s+[^-]*\|.*$", "", title)
        link = (it.findtext("link") or "").strip()
        try:
            published = parsedate_to_datetime(it.findtext("pubDate") or "")
        except (TypeError, ValueError):
            continue
        if not title or not link.startswith("https://") or not publisher:
            continue
        if published < now - timedelta(days=WINDOW_DAYS) or published > now + timedelta(hours=1):
            continue
        if not any(k in title for k in RELEVANT):
            continue
        tags, stages = tag(title)
        regions, found_places = places(title)
        items.append(
            {
                "id": hashlib.sha1(re.sub(r"\W", "", title).encode()).hexdigest()[:12],
                "title": title,
                "url": link,
                "publisher": publisher,
                "publisherUrl": publisher_url,
                "official": is_official(publisher_url),
                "publishedAt": published.astimezone(KST).isoformat(timespec="minutes"),
                "tags": tags,
                "stages": stages,
                "regions": regions,
                "places": found_places,
            }
        )
    return items


def collect(now: datetime) -> tuple[list[dict], list[str]]:
    seen: dict[str, dict] = {}
    errors: list[str] = []
    for q in QUERIES:
        try:
            for item in parse(fetch(rss_url(q)), now):
                seen.setdefault(item["id"], item)
        except Exception as e:  # 하나의 검색어 실패는 전체 실패로 보지 않는다
            errors.append(f"{q}: {e}")
    items = sorted(seen.values(), key=lambda x: x["publishedAt"], reverse=True)
    # 공식 발표는 개수 제한에서 우선 보존한다.
    official = [i for i in items if i["official"]]
    others = [i for i in items if not i["official"]]
    keep = official[: MAX_ITEMS // 3]
    keep += others[: MAX_ITEMS - len(keep)]
    return sorted(keep, key=lambda x: x["publishedAt"], reverse=True), errors


def main(argv: list[str]) -> int:
    now = datetime.now(timezone.utc)
    items, errors = collect(now)
    for e in errors:
        print(f"WARN {e}", file=sys.stderr)
    if not items:
        print("뉴스를 하나도 가져오지 못해 기존 파일을 유지합니다.", file=sys.stderr)
        return 0 if OUT.exists() else 1
    payload = {
        "updatedAt": now.astimezone(KST).isoformat(timespec="minutes"),
        "source": "Google 뉴스 RSS 검색 결과(제목·언론사·링크만 저장)",
        "items": items,
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if "--dry-run" in argv:
        print(text)
    else:
        OUT.write_text(text, encoding="utf-8")
        print(f"wrote {len(items)} items ({sum(i['official'] for i in items)} official) to {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
