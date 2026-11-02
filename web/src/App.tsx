import { useEffect, useMemo, useState, type ReactNode } from "react";
import { meta, news, rules, tracks, type Region, type Rule } from "./data";
import {
  GG_EQUALIZED,
  GG_OTHER,
  admissionYear,
  applies,
  buildStops,
  copula,
  formatRemaining,
  generationTags,
  gradeAt,
  herePosition,
  nearStages,
  regionLabel,
  relativeDay,
  regionScore,
  sortNewsForProfile,
  type Profile,
  type Stop,
  type YearMonth,
} from "./engine";
import { Sheet, Sources, type SheetContent } from "./ui";
import { KEYS, readJson, writeJson } from "./storage";
import { ForkTab } from "./Fork";
import { ThisMonth, WhatsNewList, whatsNew } from "./Today";
import { SchoolsSection } from "./Schools";

type Tab = "route" | "fork" | "news" | "school";
const TABS: [Tab, string][] = [
  ["route", "노선도"],
  ["fork", "갈림길"],
  ["news", "뉴스"],
  ["school", "학교"],
];

const EXAMPLE: Profile = { birthYear: 2012, birthMonth: 5, region: "gyeonggi", district: "용인" };
function loadProfile(): Profile | null {
  const p = readJson<Profile | null>(KEYS.profile, null);
  if (!p) return null;
  const { birthYearFrom, birthYearTo } = meta.coverage;
  return p.birthYear < birthYearFrom || p.birthYear > birthYearTo ? null : p;
}
const saveProfile = (p: Profile | null) => writeJson(KEYS.profile, p);

const tabFromHash = (): Tab => {
  const raw = window.location.hash.replace("#", "");
  const h = raw === "gloss" ? "school" : raw; // 예전 '용어' 탭 링크
  return (TABS.find(([t]) => t === h)?.[0] ?? "route") as Tab;
};

function today(): YearMonth {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}


export default function App() {
  const [saved, setSaved] = useState<Profile | null>(loadProfile);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [onboarding, setOnboarding] = useState(false);
  const [sheet, setSheet] = useState<SheetContent | null>(null);
  const now = useMemo(today, []);
  const todayDate = useMemo(() => new Date(), []);
  const profile = saved ?? EXAMPLE;
  const isExample = saved === null;
  // 지난 방문 시각은 처음 렌더할 때 한 번만 읽고, 이번 방문 시각으로 바꿔 둔다.
  const [lastVisit] = useState<string | null>(() => readJson<string | null>(KEYS.lastVisit, null));
  useEffect(() => writeJson(KEYS.lastVisit, new Date().toISOString()), []);
  const fresh = useMemo(() => whatsNew(profile, lastVisit), [profile, lastVisit]);

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
          {fresh.length > 0 && (
            <button
              className="new-badge"
              onClick={() => setSheet({ title: "지난 방문 이후 새 소식", body: <WhatsNewList items={fresh} /> })}
            >
              새 소식 <b className="num">{fresh.length}</b>
            </button>
          )}
          <button className="chip-btn" onClick={() => setOnboarding(true)}>
            {isExample ? "우리 아이로 보기" : "정보 바꾸기"}
          </button>
        </header>
        {(tab === "route" || tab === "fork") && <Hero p={profile} now={now} example={isExample} />}
        {tab === "route" && (
          <>
            <ThisMonth p={profile} now={now} today={todayDate} />
            <RouteMap
              p={profile}
              now={now}
              onStop={(s) => setSheet(stopSheet(s, () => { setSheet(null); goTab("fork"); }))}
            />
            <Changes p={profile} onRule={(r) => setSheet({ title: r.title, body: <RuleBlock r={r} /> })} />
          </>
        )}
        {tab === "fork" && (
          <ForkTab p={profile} now={now} openSheet={setSheet} closeSheet={() => setSheet(null)} />
        )}
        {tab === "news" && <News p={profile} now={now} />}
        {tab === "school" && (
          <>
            <SchoolsSection p={profile} now={now} openSheet={setSheet} />
            <Glossary />
          </>
        )}
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
        <em>{gradeAt(Y, now)}</em>
        {copula(gradeAt(Y, now))}
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

type NewsFilter = "mine" | "official" | "all";

function News({ p, now }: { p: Profile; now: YearMonth }) {
  const [filter, setFilter] = useState<NewsFilter>("mine");
  const stages = nearStages(p.birthYear, now);
  const nowMs = Date.now();
  const list = sortNewsForProfile(news.items, p).filter((n) =>
    filter === "all" ? true : filter === "official" ? n.official : n.stages.some((s) => (stages as string[]).includes(s)),
  );
  const chips: [NewsFilter, string][] = [
    ["mine", `${gradeAt(p.birthYear, now)}에게 중요한 소식`],
    ["official", "공식 발표"],
    ["all", "전체"],
  ];
  return (
    <section className="section">
      <div className="section-head">
        <h2>입시 뉴스</h2>
        <span className="eyebrow num">{news.updatedAt.slice(0, 10).split("-").join(".")} 업데이트</span>
      </div>
      <div className="filters" role="tablist" aria-label="뉴스 필터">
        {chips.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={filter === id} className="filter" onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <b>최근 30일 동안 해당 소식이 없어요</b>
          <p>다른 필터를 눌러 전체 소식을 볼 수 있어요.</p>
        </div>
      ) : (
        <ul className="news">
          {list.map((n) => (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noopener noreferrer">
                <span className="news-meta">
                  {n.official && <span className="off">공식</span>}
                  {regionScore(n, p) >= 2 && <span className="local">우리 지역</span>}
                  <span>{n.publisher}</span>
                  <span className="num">· {relativeDay(n.publishedAt, nowMs)}</span>
                </span>
                <b>{n.title}</b>
                {n.tags.length > 0 && (
                  <span className="tags">
                    {n.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="eyebrow sources-note">
        매일 아침 6시에 언론 보도와 정부 발표(대한민국 정책브리핑)를 모아요. 제목을 누르면 원문으로 이동합니다. 기사 내용은
        언론사의 것이며, 제도 확정 여부는 공식 발표로 확인하세요.
      </p>
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
  school: (
    <>
      <path d="M3 10 12 5l9 5-9 5z" />
      <path d="M7 12.5V17c3 2 7 2 10 0v-4.5M21 10v5" />
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

