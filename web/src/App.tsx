import { useEffect, useMemo, useState, type ReactNode } from "react";
import { meta, rules, schoolTypes, sourceById, tracks, type Region, type Rule, type SchoolType } from "./data";
import {
  FORK_TENDENCY,
  GG_EQUALIZED,
  GG_OTHER,
  admissionYear,
  applies,
  buildStops,
  formatRemaining,
  generationTags,
  gradeAt,
  herePosition,
  regionLabel,
  type Profile,
  type Stop,
  type YearMonth,
} from "./engine";

type Tab = "route" | "fork" | "news" | "gloss";
const TABS: [Tab, string][] = [
  ["route", "노선도"],
  ["fork", "갈림길"],
  ["news", "뉴스"],
  ["gloss", "용어"],
];

const EXAMPLE: Profile = { birthYear: 2012, birthMonth: 5, region: "gyeonggi", district: "용인" };
const STORAGE_KEY = "showmethego3.profile";

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    const { birthYearFrom, birthYearTo } = meta.coverage;
    if (p.birthYear < birthYearFrom || p.birthYear > birthYearTo) return null;
    return p;
  } catch {
    return null;
  }
}
function saveProfile(p: Profile | null) {
  try {
    if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 저장이 막힌 환경에서도 화면은 동작한다 */
  }
}

const tabFromHash = (): Tab => {
  const h = window.location.hash.replace("#", "");
  return (TABS.find(([t]) => t === h)?.[0] ?? "route") as Tab;
};

function today(): YearMonth {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

type SheetContent = { title: string; body: ReactNode };

export default function App() {
  const [saved, setSaved] = useState<Profile | null>(loadProfile);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [onboarding, setOnboarding] = useState(false);
  const [sheet, setSheet] = useState<SheetContent | null>(null);
  const now = useMemo(today, []);
  const profile = saved ?? EXAMPLE;
  const isExample = saved === null;

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const goTab = (t: Tab) => {
    window.location.hash = t === "route" ? "" : t;
    setTab(t);
    window.scrollTo(0, 0);
  };

  if (onboarding) {
    return (
      <Onboarding
        initial={saved}
        now={now}
        onCancel={() => setOnboarding(false)}
        onDone={(p) => {
          saveProfile(p);
          setSaved(p);
          setOnboarding(false);
          goTab("route");
        }}
      />
    );
  }

  return (
    <>
      <main className="app">
        <header className="top">
          <span className="brand">
            입시<b>노선도</b>
          </span>
          <button className="chip-btn" onClick={() => setOnboarding(true)}>
            {isExample ? "우리 아이로 보기" : "정보 바꾸기"}
          </button>
        </header>
        {(tab === "route" || tab === "fork") && <Hero p={profile} now={now} example={isExample} />}
        {tab === "route" && (
          <>
            <RouteMap
              p={profile}
              now={now}
              onStop={(s) => setSheet(stopSheet(s, () => { setSheet(null); goTab("fork"); }))}
            />
            <Changes p={profile} onRule={(r) => setSheet({ title: r.title, body: <RuleBlock r={r} /> })} />
          </>
        )}
        {tab === "fork" && <Fork onType={(t) => setSheet(typeSheet(t))} />}
        {tab === "news" && <News />}
        {tab === "gloss" && <Glossary />}
        <Notice />
        {!isExample && (
          <button
            className="reset"
            onClick={() => {
              saveProfile(null);
              setSaved(null);
            }}
          >
            입력한 정보 지우기
          </button>
        )}
      </main>
      <div className="tabbar">
        <nav aria-label="화면 이동">
          {TABS.map(([id, label]) => (
            <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => goTab(id)}>
              <TabIcon id={id} />
              {label}
            </button>
          ))}
        </nav>
      </div>
      {sheet && <Sheet {...sheet} onClose={() => setSheet(null)} />}
    </>
  );
}

function Hero({ p, now, example }: { p: Profile; now: YearMonth; example: boolean }) {
  const Y = p.birthYear;
  return (
    <section className="hero">
      {example && <span className="example-tag">예시 화면</span>}
      <p className="eyebrow">
        {Y}년 {p.birthMonth}월생 · {regionLabel(p)}
      </p>
      <h1>
        우리 아이는 지금
        <br />
        <em>{gradeAt(Y, now)}</em>이에요
      </h1>
      <div className="gen">
        {generationTags(p, rules).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="countdown num">
        <div>
          <small>고입 원서까지</small>
          <b>{formatRemaining(now, { year: Y + 15, month: 11 })}</b>
        </div>
        <div>
          <small>수능까지</small>
          <b>{formatRemaining(now, { year: Y + 18, month: 11 })}</b>
        </div>
        <div>
          <small>대입 학년도</small>
          <b>{admissionYear(Y)}</b>
        </div>
      </div>
    </section>
  );
}

function RouteMap({ p, now, onStop }: { p: Profile; now: YearMonth; onStop: (s: Stop) => void }) {
  const stops = buildStops(p, rules);
  const here = herePosition(stops, now);
  const hereRow = (
    <li className="here" key="here" aria-label="지금 위치">
      <div />
      <div className="rail">
        <span className="pin">나</span>
      </div>
      <span className="label num">
        지금 여기 · {now.year}.{now.month}
      </span>
    </li>
  );
  const items: ReactNode[] = [];
  stops.forEach((s, i) => {
    if (i === here) items.push(hereRow);
    const passed = i < here;
    const verify = s.rules.some((r) => r.status === "needs_verification");
    items.push(
      <li key={s.key} className={`stop ${passed ? "passed" : ""} ${s.big ? "big" : ""}`}>
        <div className="when num">
          <b>{s.year}</b>
          {s.month}월
        </div>
        <div className="rail">
          <span className="dot" />
        </div>
        <button className="card" onClick={() => onStop(s)}>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
          <div className="tags">
            {s.alert && <span className="tag alert">{s.alert}</span>}
            {s.rules.length > 0 && <span className="tag">근거 {s.rules.length}개</span>}
            {verify && <span className="tag verify">일부 확인 중</span>}
            {s.fork && <span className="tag alert">갈림길 보기</span>}
          </div>
        </button>
      </li>,
    );
  });
  if (here === stops.length) items.push(hereRow);
  return (
    <section className="section">
      <div className="section-head">
        <h2>입시 노선도</h2>
        <span className="eyebrow">눌러서 근거 보기</span>
      </div>
      <ol className="route">{items}</ol>
    </section>
  );
}

const CATEGORY_ICON: Record<string, string> = {
  수능: "수능",
  내신: "내신",
  고교학점제: "학점",
  교육과정: "과정",
  지역인재: "지역",
  의약학: "의대",
  "고교 유형": "고교",
  고입: "고입",
  중입: "중입",
  전략: "주의",
};

function Changes({ p, onRule }: { p: Profile; onRule: (r: Rule) => void }) {
  const list = rules.filter((r) => applies(r, p) && r.id !== "school-entry-age");
  return (
    <section className="section">
      <div className="section-head">
        <h2>우리 아이에게 해당하는 제도</h2>
        <span className="eyebrow num">{list.length}개</span>
      </div>
      <div className="list">
        {list.map((r) => (
          <button key={r.id} className="row" onClick={() => onRule(r)}>
            <span className="ic">{CATEGORY_ICON[r.category] ?? "•"}</span>
            <span style={{ minWidth: 0 }}>
              <b>{r.title}</b>
              <small>
                {r.status === "confirmed" ? "확인됨" : "세부 확인 중"} · {r.category}
              </small>
            </span>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const FORK_ORDER = ["general", "autonomous-private", "foreign-language-international", "science", "gifted", "vocational"];

function Fork({ onType }: { onType: (t: SchoolType) => void }) {
  const types = FORK_ORDER.map((id) => schoolTypes.find((t) => t.id === id)).filter((t): t is SchoolType => !!t);
  return (
    <section className="section">
      <div className="section-head">
        <h2>고입 갈림길</h2>
        <span className="eyebrow">옆으로 넘겨보기</span>
      </div>
      <div className="fork">
        {types.map((t) => (
          <button key={t.id} className="fork-card" onClick={() => onType(t)}>
            <span className="round">
              {t.round} · {t.scope}
            </span>
            <h3>{t.name}</h3>
            <div className="meter" aria-label="대입에서 유리한 쪽(일반적 경향)">
              <div className="bar">
                <i style={{ left: `${FORK_TENDENCY[t.id] ?? 50}%` }} />
              </div>
              <div className="ends">
                <span>내신·수시 유리</span>
                <span>수능·정시 유리</span>
              </div>
            </div>
            <ul>
              {t.fitFor.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {t.status === "needs_verification" && <span className="tag verify inline">세부 요건 확인 중</span>}
          </button>
        ))}
      </div>
      <p className="eyebrow sources-note">막대 위치는 학교 유형의 일반적인 경향이에요. 학교마다 다릅니다.</p>
    </section>
  );
}

function News() {
  return (
    <section className="section">
      <div className="section-head">
        <h2>입시 뉴스</h2>
      </div>
      <div className="empty">
        <b>매일 아침 새 소식을 모아올게요</b>
        <p>
          교육부·교육청·대교협 발표는 <span className="off-inline">공식</span> 표시로 언론 기사와 구분해서 보여드려요.
          우리 아이 학년에 해당하는 소식만 골라볼 수도 있어요.
        </p>
        <p className="eyebrow">뉴스 연결은 준비 중이에요</p>
      </div>
    </section>
  );
}

const EXTRA_TERMS: [string, string][] = [
  ["수시", "고3 9월에 원서를 내는 전형이에요. 내신·학생부·논술로 뽑고 최대 6곳까지 지원해요."],
  ["정시", "수능 성적으로 뽑는 전형이에요. 수능이 끝난 뒤 12월 말에 원서를 내요."],
  ["수능 최저학력기준", "수시에 합격하려면 넘어야 하는 최소 수능 등급이에요."],
  ["평준화 지역", "일반고를 시험 없이 추첨으로 배정하는 지역이에요."],
  ["성취평가(A~E)", "다른 학생과 비교하지 않고 도달한 수준으로 매기는 성적이에요."],
];

function Glossary() {
  return (
    <section className="section">
      <div className="section-head">
        <h2>입시 용어</h2>
      </div>
      <dl className="gloss">
        {tracks.map((t) => (
          <div key={t.id}>
            <dt>{t.name}</dt>
            <dd>{t.summary}</dd>
          </div>
        ))}
        {EXTRA_TERMS.map(([a, b]) => (
          <div key={a}>
            <dt>{a}</dt>
            <dd>{b}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Notice() {
  return (
    <p className="notice">
      <span aria-hidden>ⓘ</span>
      <span>
        <b>참고용 정보예요.</b> {meta.disclaimer} 자료 기준일 {meta.lastReviewed}.
      </span>
    </p>
  );
}

function Sources({ ids }: { ids: string[] }) {
  const list = ids.map((id) => sourceById.get(id)).filter((s) => !!s);
  if (!list.length) return null;
  return (
    <div className="src">
      {list.map((s) => (
        <span key={s!.id}>
          {s!.official && <span className="off">공식</span>}
          <a href={s!.url} target="_blank" rel="noopener noreferrer">
            {s!.publisher} · {s!.title}
          </a>
          {s!.date && <span className="num"> ({s!.date})</span>}
        </span>
      ))}
    </div>
  );
}

function RuleBlock({ r }: { r: Rule }) {
  return (
    <div className="rule">
      <span className={`status ${r.status}`}>{meta.statusLabels[r.status]}</span>
      <h3>{r.title}</h3>
      <p>{r.summary}</p>
      {r.note && <p className="eyebrow">{r.note}</p>}
      <Sources ids={r.sources} />
    </div>
  );
}

function stopSheet(s: Stop, toFork: () => void): SheetContent {
  return {
    title: `${s.year}년 ${s.month}월 · ${s.title}`,
    body: (
      <>
        <p>{s.text}</p>
        {s.fork && (
          <button className="ghost" style={{ alignSelf: "flex-start", color: "var(--accent)" }} onClick={toFork}>
            고교 유형별 갈림길 보기 ›
          </button>
        )}
        {s.rules.map((r) => (
          <RuleBlock key={r.id} r={r} />
        ))}
      </>
    ),
  };
}

function typeSheet(t: SchoolType): SheetContent {
  return {
    title: t.name,
    body: (
      <>
        <p>{t.summary}</p>
        <div className="rule">
          <h3>이런 아이에게</h3>
          <p>{t.fitFor.join(", ")}</p>
          <h3>주의할 점</h3>
          <p>{t.watchOut.join(" / ")}</p>
          <p className="eyebrow">선발: {t.selectedBy}</p>
          <span className={`status ${t.status}`}>{meta.statusLabels[t.status]}</span>
          <Sources ids={t.sources} />
        </div>
      </>
    ),
  };
}

function Sheet({ title, body, onClose }: SheetContent & { onClose: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-inner">
          <div className="grab" />
          <h2>{title}</h2>
          {body}
          <p className="eyebrow">참고용 정보예요. 최종 결정 전 공식 모집요강으로 꼭 확인하세요.</p>
          <button className="primary" autoFocus onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </>
  );
}

function Onboarding({
  initial,
  now,
  onCancel,
  onDone,
}: {
  initial: Profile | null;
  now: YearMonth;
  onCancel: () => void;
  onDone: (p: Profile) => void;
}) {
  const [step, setStep] = useState(1);
  const [y, setY] = useState<number | null>(initial?.birthYear ?? null);
  const [m, setM] = useState<number | null>(initial?.birthMonth ?? null);
  const [region, setRegion] = useState<Region | null>(initial?.region ?? null);
  const [district, setDistrict] = useState<string | null>(initial?.district ?? null);

  const years: number[] = [];
  for (let v = meta.coverage.birthYearTo; v >= meta.coverage.birthYearFrom; v--) years.push(v);
  const equalized = district !== null && (GG_EQUALIZED as readonly string[]).includes(district);
  const ready = step === 1 ? y !== null : step === 2 ? m !== null : region === "seoul" || (region === "gyeonggi" && !!district);

  const next = () => {
    if (step < 3) setStep(step + 1);
    else onDone({ birthYear: y!, birthMonth: m!, region: region!, district: region === "seoul" ? null : district });
  };

  return (
    <main className="app">
      <button className="ghost" style={{ alignSelf: "flex-start", paddingLeft: 0 }} onClick={() => (step === 1 ? onCancel() : setStep(step - 1))}>
        ‹ {step === 1 ? "닫기" : "이전"}
      </button>
      <div className="steps" aria-label={`3단계 중 ${step}단계`}>
        {[1, 2, 3].map((i) => (
          <i key={i} className={i <= step ? "on" : ""} />
        ))}
      </div>
      {step === 1 && (
        <>
          <h1 className="ob-q">아이는 몇 년생인가요?</h1>
          <div className="years num">
            {years.map((v) => (
              <button key={v} className="pick" aria-pressed={y === v} onClick={() => setY(v)}>
                {v}
                <small>지금 {gradeAt(v, now)}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h1 className="ob-q">{y}년 몇 월에 태어났나요?</h1>
          <div className="months num">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((v) => (
              <button key={v} className="pick" aria-pressed={m === v} onClick={() => setM(v)}>
                {v}월
              </button>
            ))}
          </div>
          <p className="live" aria-live="polite">
            {m !== null && m <= 2 ? "1·2월생도 같은 해 친구들과 함께 입학해요. 조기입학이나 입학유예를 했다면 학년이 달라질 수 있어요." : ""}
          </p>
        </>
      )}
      {step === 3 && (
        <>
          <h1 className="ob-q">어디에 살고 있나요?</h1>
          <div className="regions">
            {(["seoul", "gyeonggi"] as Region[]).map((r) => (
              <button
                key={r}
                className="pick"
                aria-pressed={region === r}
                onClick={() => {
                  setRegion(r);
                  if (r === "seoul") setDistrict(null);
                }}
              >
                {meta.regions[r]}
              </button>
            ))}
          </div>
          {region === "gyeonggi" && (
            <>
              <p className="eyebrow">고등학교 학군을 골라주세요</p>
              <div className="districts">
                {[...GG_EQUALIZED, GG_OTHER].map((d) => (
                  <button key={d} className="pick" aria-pressed={district === d} onClick={() => setDistrict(d)}>
                    {d === GG_OTHER ? "그 외 지역(비평준화)" : d}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="live" aria-live="polite">
            {region === "gyeonggi" && district
              ? equalized
                ? "평준화 학군이에요. 일반고는 내신으로 선발한 뒤 추첨으로 배정돼요."
                : "비평준화 지역이에요. 고입에서 중학교 내신이 특히 중요해요."
              : ""}
          </p>
          <p className="eyebrow">지금은 서울·경기만 지원해요. 다른 지역은 곧 추가됩니다.</p>
        </>
      )}
      <button className="primary" disabled={!ready} onClick={next}>
        {step < 3 ? "다음" : "노선도 만들기"}
      </button>
      {initial === null && step === 1 && <p className="eyebrow">입력한 정보는 이 기기에만 저장돼요.</p>}
    </main>
  );
}

const ICON_PATHS: Record<Tab, ReactNode> = {
  route: (
    <>
      <circle cx="6" cy="5" r="2.5" fill="currentColor" />
      <circle cx="18" cy="19" r="2.5" fill="currentColor" />
      <path d="M6 7.5v4a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v-1" />
    </>
  ),
  fork: <path d="M12 21v-8M12 13 6 6M12 13l6-7M4 6h4M16 6h4" />,
  news: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </>
  ),
  gloss: (
    <>
      <path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z" />
      <path d="M9 9h6M9 13h4" />
    </>
  ),
};

function TabIcon({ id }: { id: Tab }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      {ICON_PATHS[id]}
    </svg>
  );
}

