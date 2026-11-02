# showmethego3

아이의 **생년월**과 **사는 지역**을 넣으면 중학교 → 고등학교 → 대학까지 챙겨야 할 입시 제도와 전략을 한눈에 보여주는 서비스입니다.
배포 주소(예정): https://torajim.github.io/showmethego3/

> ⚠️ 이 서비스의 입시 정보는 공개 자료를 정리한 **참고용**입니다. 입시 제도와 학교별 전형은 수시로 바뀌고 개인 상황에 따라 적용이 다를 수 있으니, 최종 결정 전에는 반드시 교육청·대학의 공식 모집요강과 학교 선생님을 통해 직접 확인하세요.

## 진행 단계

1. 입시 제도 데이터 정리 ✓
2. **전략 엔진과 모바일 UI (TypeScript + React)** ← 현재
3. GitHub Pages 웹 MVP + 입시 뉴스(하루 1회 자동 수집, 수동 실행 가능)
4. 전국 확장, 앱(PWA → 스토어), SEO, 학원용 자료

첫 버전 범위: **서울·경기**, **2008~2020년생**.

## 데이터 구조 (`data/`)

| 파일 | 내용 |
|---|---|
| `meta.json` | 서비스 범위, 지역 코드, 상태 라벨, 면책 문구 |
| `sources.json` | 모든 근거 자료(발행처·날짜·URL·공식 여부) |
| `rules.json` | 출생연도·지역별로 적용되는 제도 규칙 |
| `school_types.json` | 고교 유형(영재학교·과고·외고/국제고·자사고·일반고·특성화고) |
| `university_tracks.json` | 대입 전형 유형(교과·종합·논술·정시·지역인재·지역의사) |
| `generated/cohorts.json` | 출생연도별 입학 연도와 적용 규칙 목록(자동 생성) |

각 항목에는 `status`가 있습니다.

- `confirmed`: 공식 발표나 보도로 확인됨
- `needs_verification`: 큰 틀은 맞지만 세부 수치를 원문으로 확인하는 중 (화면에 "확인 중" 표시)
- `planned`: 발표된 예정 사항

## 사용법 (Python 3.11+, 표준 라이브러리만 사용)

```bash
python scripts/admissions.py validate     # 데이터 검증
python scripts/admissions.py build        # data/generated/cohorts.json 재생성
python scripts/admissions.py show 2012 gyeonggi
python -m unittest discover -s tests
```

규칙을 고치거나 추가하면 `build`를 다시 실행해 생성 파일도 함께 커밋하세요. CI가 확인합니다.

## 웹 앱 (`web/`)

```bash
cd web
npm install
npm run dev      # http://localhost:5173/showmethego3/
npm test         # 전략 엔진 테스트
npm run build    # web/dist
```

- `src/engine.ts`: 생년월·지역 → 노선도 역, 세대 키워드, 남은 기간 계산 (순수 함수)
- `src/App.tsx`: 노선도 / 갈림길 / 뉴스 / 용어 탭, 3단계 입력, 근거 바텀시트
- `data/*.json`을 빌드 시점에 그대로 가져다 씁니다.

### 배포

`main`에 머지되면 `.github/workflows/pages.yml`이 https://torajim.github.io/showmethego3/ 로 배포합니다(Actions 탭에서 수동 실행도 가능).
처음 한 번은 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 바꿔야 합니다. 기존 torajim.github.io 사이트와 다른 저장소에는 영향을 주지 않습니다.
