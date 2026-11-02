"""입시 데이터 로딩, 검증, 출생연도별 타임라인 계산.

표준 라이브러리만 사용합니다. 사용법:
    python scripts/admissions.py validate
    python scripts/admissions.py build      # data/generated/cohorts.json 생성
    python scripts/admissions.py show 2012  # 특정 출생연도 요약 출력
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
GENERATED = DATA / "generated"

STAGES = {"all", "middle", "high", "university"}
STATUSES = {"confirmed", "needs_verification", "planned"}
DATE_RE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")
ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# 2009학년도부터 1~12월 출생자가 같은 해 3월에 초등학교에 함께 입학한다.
ELEMENTARY_ENTRY_OFFSET = 7


def load(name: str) -> dict:
    with open(DATA / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


@dataclass(frozen=True)
class Milestones:
    birth_year: int
    elementary_entry: int  # 초1 입학 연도(3월)
    middle_entry: int  # 중1 입학 연도
    high_entry: int  # 고1 입학 연도
    csat_exam_year: int  # 수능 응시 연도(11월, 고3)
    admission_year: int  # 대입 학년도(= 대학 입학 연도)

    @property
    def high_school_admission_year(self) -> int:
        """고입 학년도(= 고1 입학 연도). 원서는 그 전년도 중3 가을~겨울에 낸다."""
        return self.high_entry


def milestones(birth_year: int) -> Milestones:
    e = birth_year + ELEMENTARY_ENTRY_OFFSET
    return Milestones(
        birth_year=birth_year,
        elementary_entry=e,
        middle_entry=e + 6,
        high_entry=e + 9,
        csat_exam_year=e + 11,
        admission_year=e + 12,
    )


def grade_in(birth_year: int, year: int, month: int) -> str:
    """주어진 시점(연·월)의 학년 이름. 학년은 3월에 바뀐다고 가정한다."""
    school_year = year if month >= 3 else year - 1
    n = school_year - milestones(birth_year).elementary_entry + 1
    if n <= 0:
        return "미취학"
    if n <= 6:
        return f"초{n}"
    if n <= 9:
        return f"중{n - 6}"
    if n <= 12:
        return f"고{n - 9}"
    return "고교 졸업 이후"


def rules_for(birth_year: int, region: str, rules: list[dict]) -> list[dict]:
    return [
        r
        for r in rules
        if r["appliesTo"]["birthYearFrom"] <= birth_year <= r["appliesTo"]["birthYearTo"]
        and ("KR" in r["regions"] or region in r["regions"])
    ]


def validate() -> list[str]:
    errors: list[str] = []
    meta = load("meta")
    sources = load("sources")["sources"]
    rules = load("rules")["rules"]
    school_types = load("school_types")["highSchoolTypes"]
    tracks = load("university_tracks")["tracks"]

    regions = set(meta["regions"])
    if not meta.get("disclaimer"):
        errors.append("meta: disclaimer가 비어 있습니다")
    if not DATE_RE.match(meta.get("lastReviewed", "")):
        errors.append("meta: lastReviewed 형식 오류")
    cov = meta["coverage"]

    source_ids: set[str] = set()
    for s in sources:
        sid = s.get("id", "")
        where = f"sources[{sid}]"
        if not ID_RE.match(sid):
            errors.append(f"{where}: id 형식 오류")
        if sid in source_ids:
            errors.append(f"{where}: id 중복")
        source_ids.add(sid)
        for key in ("title", "publisher", "url", "accessed"):
            if not s.get(key):
                errors.append(f"{where}: {key} 누락")
        if not str(s.get("url", "")).startswith("https://"):
            errors.append(f"{where}: url은 https여야 합니다")
        if s.get("date") is not None and not DATE_RE.match(s["date"]):
            errors.append(f"{where}: date 형식 오류")
        if not isinstance(s.get("official"), bool):
            errors.append(f"{where}: official은 true/false여야 합니다")

    def check_sources(where: str, item: dict) -> None:
        for ref in item.get("sources", []):
            if ref not in source_ids:
                errors.append(f"{where}: 존재하지 않는 출처 '{ref}'")
        status = item.get("status")
        if status not in STATUSES:
            errors.append(f"{where}: status '{status}' 오류")
        if status == "confirmed" and not item.get("sources") and not item.get("note"):
            errors.append(f"{where}: confirmed 항목에는 출처 또는 근거 note가 필요합니다")
        if status == "needs_verification" and not item.get("note") and not item.get("watchOut"):
            # 확인 중인 항목은 무엇을 확인해야 하는지 남긴다(학교 유형은 watchOut으로 대신)
            errors.append(f"{where}: needs_verification 항목에는 note가 필요합니다")

    rule_ids: set[str] = set()
    for r in rules:
        rid = r.get("id", "")
        where = f"rules[{rid}]"
        if not ID_RE.match(rid):
            errors.append(f"{where}: id 형식 오류")
        if rid in rule_ids:
            errors.append(f"{where}: id 중복")
        rule_ids.add(rid)
        for key in ("title", "summary", "category"):
            if not r.get(key):
                errors.append(f"{where}: {key} 누락")
        if r.get("stage") not in STAGES:
            errors.append(f"{where}: stage 오류")
        a = r.get("appliesTo", {})
        lo, hi = a.get("birthYearFrom"), a.get("birthYearTo")
        if not (isinstance(lo, int) and isinstance(hi, int) and lo <= hi):
            errors.append(f"{where}: appliesTo 범위 오류")
        elif lo < cov["birthYearFrom"] or hi > cov["birthYearTo"]:
            errors.append(f"{where}: appliesTo가 서비스 범위를 벗어납니다")
        if not r.get("regions") or any(x not in regions for x in r["regions"]):
            errors.append(f"{where}: regions 오류")
        check_sources(where, r)

    for t in school_types:
        check_sources(f"highSchoolTypes[{t.get('id')}]", t)
    for t in tracks:
        check_sources(f"tracks[{t.get('id')}]", t)

    # 서비스 범위의 모든 출생연도·지역에 수능/내신 규칙이 정확히 하나씩 있어야 한다.
    for year in range(cov["birthYearFrom"], cov["birthYearTo"] + 1):
        for region in cov["regions"]:
            applicable = rules_for(year, region, rules)
            for category in ("수능", "내신"):
                n = sum(1 for r in applicable if r["category"] == category)
                if n != 1:
                    errors.append(f"{year}년생/{region}: '{category}' 규칙이 {n}개입니다(1개여야 함)")
    return errors


def build() -> Path:
    meta = load("meta")
    rules = load("rules")["rules"]
    cov = meta["coverage"]
    cohorts = []
    for year in range(cov["birthYearFrom"], cov["birthYearTo"] + 1):
        m = milestones(year)
        cohorts.append(
            {
                "birthYear": year,
                "elementaryEntry": m.elementary_entry,
                "middleEntry": m.middle_entry,
                "highEntry": m.high_entry,
                "csatExamYear": m.csat_exam_year,
                "admissionYear": m.admission_year,
                "rulesByRegion": {
                    region: [r["id"] for r in rules_for(year, region, rules)]
                    for region in cov["regions"]
                },
            }
        )
    GENERATED.mkdir(exist_ok=True)
    out = GENERATED / "cohorts.json"
    out.write_text(
        json.dumps({"generatedFrom": meta["lastReviewed"], "cohorts": cohorts}, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    return out


def show(birth_year: int, region: str = "seoul") -> None:
    m = milestones(birth_year)
    print(f"{birth_year}년생 ({region})")
    print(f"  초1 {m.elementary_entry}.3 / 중1 {m.middle_entry}.3 / 고1 {m.high_entry}.3")
    print(f"  수능 {m.csat_exam_year}.11 → {m.admission_year}학년도 대입")
    for r in rules_for(birth_year, region, load("rules")["rules"]):
        flag = "" if r["status"] == "confirmed" else f" [{r['status']}]"
        print(f"  - [{r['category']}] {r['title']}{flag}")


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else "validate"
    if cmd == "validate":
        errors = validate()
        for e in errors:
            print(f"ERROR {e}")
        print("OK" if not errors else f"{len(errors)} error(s)")
        return 1 if errors else 0
    if cmd == "build":
        errors = validate()
        if errors:
            print("\n".join(errors))
            return 1
        print(f"wrote {build().relative_to(ROOT)}")
        return 0
    if cmd == "show":
        show(int(argv[2]), argv[3] if len(argv) > 3 else "seoul")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
