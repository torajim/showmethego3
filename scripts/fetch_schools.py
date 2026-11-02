"""우리 지역 학교 목록: 학교알리미 공시정보 OpenAPI에서 서울·경기 중·고등학교 기본 정보를 모아
data/schools.json에 저장한다.

- 표준 라이브러리만 사용한다.
- 인증키는 환경변수 SCHOOLINFO_API_KEY에서 읽는다(저장소 Secrets). 키를 코드나 파일에 남기지 않는다.
- 2026년 이후 발급된 키는 시·군·구(sggCode) 입력이 필수라서 시·군·구마다 따로 호출한다.
- 학교 서열화로 오해될 수 있는 진학 실적·학업성취는 다루지 않는다(학교알리미 OpenAPI에도 없음).
- 한 지역이라도 실패하면 기존 파일을 그대로 두고 종료한다(사이트에서 일부 학교만 사라지지 않도록).

출처: 학교알리미(www.schoolinfo.go.kr) 공시정보, 공공누리 제1유형(출처표시).

사용법:
    SCHOOLINFO_API_KEY=... python scripts/fetch_schools.py
    SCHOOLINFO_API_KEY=... python scripts/fetch_schools.py --dry-run
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "schools.json"
API = "https://www.schoolinfo.go.kr/openApi.do"
KST = timezone(timedelta(hours=9))

LEVELS = {"03": "middle", "04": "high"}

# apiType: 0 학교기본정보, 09 학년별·학급별 학생수(교원 1인당 학생수 포함),
#          10 전·출입 및 학업중단, 56 동아리 활동 현황
TYPES = ("0", "09", "10", "56")

# 학교알리미 시도시군구코드.xlsx (2026년 화성시 4개 구 반영)
AREAS: dict[str, dict[str, str]] = {
    "seoul": {
        "11110": "종로구", "11140": "중구", "11170": "용산구", "11200": "성동구", "11215": "광진구",
        "11230": "동대문구", "11260": "중랑구", "11290": "성북구", "11305": "강북구", "11320": "도봉구",
        "11350": "노원구", "11380": "은평구", "11410": "서대문구", "11440": "마포구", "11470": "양천구",
        "11500": "강서구", "11530": "구로구", "11545": "금천구", "11560": "영등포구", "11590": "동작구",
        "11620": "관악구", "11650": "서초구", "11680": "강남구", "11710": "송파구", "11740": "강동구",
    },
    "gyeonggi": {
        "41111": "수원시 장안구", "41113": "수원시 권선구", "41115": "수원시 팔달구", "41117": "수원시 영통구",
        "41131": "성남시 수정구", "41133": "성남시 중원구", "41135": "성남시 분당구", "41150": "의정부시",
        "41171": "안양시 만안구", "41173": "안양시 동안구", "41192": "부천시 원미구", "41194": "부천시 소사구",
        "41196": "부천시 오정구", "41210": "광명시", "41220": "평택시", "41250": "동두천시",
        "41271": "안산시 상록구", "41273": "안산시 단원구", "41281": "고양시 덕양구", "41285": "고양시 일산동구",
        "41287": "고양시 일산서구", "41290": "과천시", "41310": "구리시", "41360": "남양주시", "41370": "오산시",
        "41390": "시흥시", "41410": "군포시", "41430": "의왕시", "41450": "하남시", "41461": "용인시 처인구",
        "41463": "용인시 기흥구", "41465": "용인시 수지구", "41480": "파주시", "41500": "이천시", "41550": "안성시",
        "41570": "김포시", "41591": "화성시 만세구", "41593": "화성시 효행구", "41595": "화성시 병점구",
        "41597": "화성시 동탄구", "41610": "광주시", "41630": "양주시", "41650": "포천시", "41670": "여주시",
        "41800": "연천군", "41820": "가평군", "41830": "양평군",
    },
}
SIDO = {"seoul": "11", "gyeonggi": "41"}

HIGH_KIND = {
    "일반고등학교": "일반고",
    "자율고등학교": "자율고",
    "특수목적고등학교": "특목고",
    "특성화고등학교": "특성화고",
}


def num(v) -> float | None:
    """'940(15)'처럼 괄호 안에 특수학급 수가 붙은 값도 앞 숫자만 읽는다."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    m = re.match(r"\s*(-?\d+(?:\.\d+)?)", str(v))
    if not m:
        return None
    f = float(m.group(1))
    return int(f) if f.is_integer() else f


def call(key: str, api_type: str, sido: str, sgg: str, level: str, year: int) -> list[dict]:
    body = urllib.parse.urlencode(
        {"apiKey": key, "apiType": api_type, "pbanYr": year, "sidoCode": sido, "sggCode": sgg, "schulKndCode": level}
    ).encode()
    req = urllib.request.Request(API, data=body, headers={"User-Agent": "showmethego3-bot"})
    last: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                data = json.loads(res.read().decode("utf-8"))
            if data.get("resultCode") != "success":
                raise RuntimeError(f"{api_type}/{sgg}/{level}: {data.get('resultMsg')}")
            return data.get("list") or []
        except Exception as e:  # noqa: BLE001 - 네트워크·응답 오류 모두 재시도
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(str(last))


def merge(region: str, area: str, level: str, rows: dict[str, list[dict]]) -> list[dict]:
    """같은 학교코드의 여러 공시 항목을 학교 하나로 합친다."""
    by = {t: {r["SCHUL_CODE"]: r for r in rows.get(t, [])} for t in TYPES}
    out = []
    for code, b in by["0"].items():
        if b.get("ABSCH_YN") == "Y" or b.get("CLOSE_YN") == "Y" or b.get("DGHT_SC_CODE") not in (None, "주간"):
            continue
        s = by["09"].get(code, {})
        mv = by["10"].get(code, {})
        cl = by["56"].get(code, {})
        clubs = [num(cl.get("CREAT_EXPER_ACT_CCCLU_FGR")), num(cl.get("STDNT_SLCTL_CCCLU_FGR"))]
        school = {
            "code": code,
            "name": b["SCHUL_NM"],
            "level": LEVELS[level],
            "region": region,
            "area": area,
            "kind": HIGH_KIND.get(b.get("HS_KND_SC_NM") or "", b.get("HS_KND_SC_NM")) if level == "04" else None,
            "found": b.get("FOND_SC_CODE"),
            "coed": b.get("COEDU_SC_CODE"),
            "addr": (b.get("SCHUL_RDNMA") or "").strip() or None,
            "lat": num(b.get("LTTUD")),
            "lng": num(b.get("LGTUD")),
            "url": (b.get("HMPG_ADRES") or "").strip() or None,
            "infoId": b.get("SHL_IDF_CD"),
            "students": num(s.get("COL_S_SUM")),
            "byGrade": [num(s.get(f"COL_S{g}")) for g in (1, 2, 3)],
            "classes": num(s.get("COL_C_SUM")),
            "perClass": num(s.get("COL_SUM")),
            "teachers": num(s.get("TEACH_CNT")),
            "perTeacher": num(s.get("TEACH_CAL")),
            "moveIn": num(mv.get("MVIN_SUM")),
            "moveOut": num(mv.get("MVT_SUM")),
            "clubs": sum(c for c in clubs if c is not None) if any(c is not None for c in clubs) else None,
        }
        out.append(school)
    return out


def collect(key: str, year: int, pause: float = 0.15) -> list[dict]:
    schools: list[dict] = []
    for region, areas in AREAS.items():
        for sgg, area in areas.items():
            for level in LEVELS:
                rows = {t: call(key, t, SIDO[region], sgg, level, year) for t in TYPES}
                schools.extend(merge(region, area, level, rows))
                time.sleep(pause)
    schools.sort(key=lambda s: (s["region"], s["area"], s["level"], s["name"]))
    return schools


def main(argv: list[str]) -> int:
    key = os.environ.get("SCHOOLINFO_API_KEY", "").strip()
    if not key:
        print("SCHOOLINFO_API_KEY가 없습니다. 저장소 Settings → Secrets and variables → Actions → "
              "Repository secrets에 같은 이름으로 넣어 주세요.", file=sys.stderr)
        # GitHub Actions에서는 실패로 표시해 키 누락을 바로 알 수 있게 한다.
        return 1 if os.environ.get("GITHUB_ACTIONS") == "true" else 0
    now = datetime.now(KST)
    schools: list[dict] = []
    year = now.year
    # 올해 공시가 아직 없거나 비어 있으면 작년 공시를 쓴다.
    for year in (now.year, now.year - 1):
        try:
            schools = collect(key, year)
        except RuntimeError as e:
            print(f"{year}년 공시 수집 실패: {e}", file=sys.stderr)
            schools = []
        if len(schools) > 500:
            break
    if len(schools) <= 500:
        print("학교 수집 결과가 너무 적어 기존 파일을 유지합니다.", file=sys.stderr)
        return 1
    doc = {
        "fetchedAt": now.isoformat(timespec="seconds"),
        "pbanYear": year,
        "source": {
            "title": "학교알리미 공시정보",
            "publisher": "교육부·한국교육학술정보원",
            "url": "https://www.schoolinfo.go.kr",
            "license": "공공누리 제1유형(출처표시)",
        },
        "schools": schools,
    }
    if "--dry-run" in argv:
        print(json.dumps({**doc, "schools": schools[:3]}, ensure_ascii=False, indent=2))
        print(f"학교 {len(schools)}곳", file=sys.stderr)
        return 0
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: 학교 {len(schools)}곳 ({year}년 공시)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
