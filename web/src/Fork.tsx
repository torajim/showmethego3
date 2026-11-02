import { useState, type ReactNode } from "react";
import { meta, schoolTypes, type SchoolType } from "./data";
import { FORK_TENDENCY, type Profile, type YearMonth, monthIndex } from "./engine";
import { QUESTIONS, applyYear, recommend, type Answers, type Recommendation } from "./planner";
import { KEYS, readJson, writeJson } from "./storage";
import { Sources, type SheetContent } from "./ui";

const FORK_ORDER = ["general", "autonomous-private", "foreign-language-international", "science", "gifted", "vocational"];
const ordered = () => FORK_ORDER.map((id) => schoolTypes.find((t) => t.id === id)).filter((t): t is SchoolType => !!t);

const FIT_LABEL: Record<Recommendation["fit"], string> = { good: "잘 맞아요", maybe: "고려해 볼 만해요", careful: "신중하게" };

interface Props {
  p: Profile;
  now: YearMonth;
  openSheet: (s: SheetContent) => void;
  closeSheet: () => void;
}

export function ForkTab({ p, now, openSheet, closeSheet }: Props) {
  const [answers, setAnswers] = useState<Answers | null>(() => readJson<Answers | null>(KEYS.answers, null));
  const [compare, setCompare] = useState<string[]>(() => readJson<string[]>(KEYS.compare, []));
  const types = ordered();

  const saveAnswers = (a: Answers | null) => {
    setAnswers(a);
    writeJson(KEYS.answers, a);
  };
  const toggleCompare = (id: string) => {
    const next = compare.includes(id) ? compare.filter((x) => x !== id) : [...compare, id].slice(-2);
    setCompare(next);
    writeJson(KEYS.compare, next);
  };
  const openQuiz = () =>
    openSheet({
      title: "우리 아이 맞춤 추천",
      body: (
        <Quiz
          initial={answers}
          onDone={(a) => {
            saveAnswers(a);
            closeSheet();
          }}
        />
      ),
    });
  const openType = (t: SchoolType) => openSheet({ title: t.name, body: <TypeDetail t={t} p={p} now={now} /> });

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2>우리 아이에게 맞는 고등학교</h2>
          {answers && (
            <button className="link-btn" onClick={openQuiz}>
              다시 답하기
            </button>
          )}
        </div>
        {answers ? (
          <Ranking recs={recommend(types, answers)} onOpen={openType} />
        ) : (
          <button className="cta-card" onClick={openQuiz}>
            <b>질문 4개로 맞춤 추천 받기</b>
            <span>진로, 성적, 공부 스타일, 학비 부담을 알려주시면 고교 유형을 맞는 순서대로 이유와 함께 보여드려요.</span>
            <span className="cta-go">시작하기 ›</span>
          </button>
        )}
      </section>

      <ApplyTimeline p={p} now={now} types={types} onOpen={openType} />

      <section className="section">
        <div className="section-head">
          <h2>유형별로 살펴보기</h2>
          <span className="eyebrow">2개를 골라 비교해요</span>
        </div>
        <div className="fork">
          {types.map((t) => (
            <div key={t.id} className="fork-card">
              <button className="fork-open" onClick={() => openType(t)}>
                <span className="round">
                  {t.round} · {t.scope}
                </span>
                <h3>{t.name}</h3>
                <Meter id={t.id} />
                <ul>
                  {t.fitFor.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {t.status === "needs_verification" && <span className="tag verify inline">세부 요건 확인 중</span>}
                <span className="cta-go">준비 체크리스트 ›</span>
              </button>
              <button
                className="compare-toggle"
                aria-pressed={compare.includes(t.id)}
                onClick={() => toggleCompare(t.id)}
              >
                {compare.includes(t.id) ? "✓ 비교에 담음" : "+ 비교에 담기"}
              </button>
            </div>
          ))}
        </div>
        <p className="eyebrow sources-note">막대 위치는 학교 유형의 일반적인 경향이에요. 학교마다 다릅니다.</p>
      </section>

      {compare.length > 0 && (
        <div className="compare-bar">
          <span>
            {compare.map((id) => types.find((t) => t.id === id)?.name).join(" vs ")}
            {compare.length < 2 && " · 하나 더 골라주세요"}
          </span>
          <button
            className="compare-go"
            disabled={compare.length < 2}
            onClick={() =>
              openSheet({
                title: "나란히 비교",
                body: <Compare a={types.find((t) => t.id === compare[0])!} b={types.find((t) => t.id === compare[1])!} p={p} />,
              })
            }
          >
            비교하기
          </button>
        </div>
      )}
      {compare.length > 0 && <div className="compare-space" aria-hidden="true" />}
    </>
  );
}

function Meter({ id }: { id: string }) {
  return (
    <div className="meter" aria-label="대입에서 유리한 쪽(일반적 경향)">
      <div className="bar">
        <i style={{ left: `${FORK_TENDENCY[id] ?? 50}%` }} />
      </div>
      <div className="ends">
        <span>내신·수시 유리</span>
        <span>수능·정시 유리</span>
      </div>
    </div>
  );
}

function Ranking({ recs, onOpen }: { recs: Recommendation[]; onOpen: (t: SchoolType) => void }) {
  return (
    <ol className="rank">
      {recs.map((r, i) => (
        <li key={r.type.id}>
          <button className="rank-row" onClick={() => onOpen(r.type)}>
            <span className="rank-no num">{i + 1}</span>
            <span className="rank-body">
              <span className="rank-head">
                <b>{r.type.name}</b>
                <span className={`fit ${r.fit}`}>{FIT_LABEL[r.fit]}</span>
              </span>
              <span className="rank-why">{r.reasons[0]}</span>
              {r.reasons.length > 1 && <span className="rank-more">{r.reasons.slice(1).join(" ")}</span>}
            </span>
          </button>
        </li>
      ))}
      <li className="rank-note eyebrow">답변을 바탕으로 한 일반적인 경향이에요. 학교별 전형과 아이의 상황을 함께 살펴보세요.</li>
    </ol>
  );
}

function ApplyTimeline({ p, now, types, onOpen }: { p: Profile; now: YearMonth; types: SchoolType[]; onOpen: (t: SchoolType) => void }) {
  const rows = [...types]
    .map((t) => {
      const year = applyYear(p.birthYear, t.apply.months);
      const month = parseInt(t.apply.months, 10);
      return { t, year, past: monthIndex({ year, month }) < monthIndex(now) };
    })
    .sort((a, b) => a.year - b.year || parseInt(a.t.apply.months, 10) - parseInt(b.t.apply.months, 10));
  return (
    <section className="section">
      <div className="section-head">
        <h2>우리 아이 원서 시기</h2>
        <span className="eyebrow">예년 기준</span>
      </div>
      <ol className="apply">
        {rows.map(({ t, year, past }) => (
          <li key={t.id} className={past ? "past" : ""}>
            <button onClick={() => onOpen(t)}>
              <span className="apply-when num">
                <b>{year}</b>
                {t.apply.months}
              </span>
              <span className="apply-what">
                <b>{t.name}</b>
                <small>
                  {t.apply.grade} · {t.round}
                  {past ? " · 지났어요" : ""}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Quiz({ initial, onDone }: { initial: Answers | null; onDone: (a: Answers) => void }) {
  const [a, setA] = useState<Partial<Answers> & { cost?: "yes" | "no" }>(
    initial ? { ...initial, cost: initial.costSensitive ? "yes" : "no" } : {},
  );
  const ready = a.track && a.level && a.style && a.cost;
  const group = <K extends "track" | "level" | "style" | "cost">(key: K) => (
    <fieldset className="quiz-q">
      <legend>{QUESTIONS[key].q}</legend>
      <div className="quiz-opts">
        {QUESTIONS[key].options.map(([v, label]) => (
          <button key={v} className="pick" aria-pressed={a[key] === v} onClick={() => setA({ ...a, [key]: v })}>
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
  return (
    <>
      {group("track")}
      {group("level")}
      {group("style")}
      {group("cost")}
      <button
        className="primary"
        disabled={!ready}
        onClick={() =>
          onDone({ track: a.track!, level: a.level!, style: a.style!, costSensitive: a.cost === "yes" })
        }
      >
        추천 보기
      </button>
      <p className="eyebrow">답변은 이 기기에만 저장돼요.</p>
    </>
  );
}

function TypeDetail({ t, p, now }: { t: SchoolType; p: Profile; now: YearMonth }) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => readJson(KEYS.checks, {}));
  const toggle = (k: string) => {
    const next = { ...checks, [k]: !checks[k] };
    setChecks(next);
    writeJson(KEYS.checks, next);
  };
  const year = applyYear(p.birthYear, t.apply.months);
  const past = monthIndex({ year, month: parseInt(t.apply.months, 10) }) < monthIndex(now);
  const done = t.checklist.filter((_, i) => checks[`${t.id}:${i}`]).length;
  return (
    <>
      <p>{t.summary}</p>
      <div className="rule">
        <h3>
          원서 시기: {year}년 {t.apply.months} ({t.apply.grade})
        </h3>
        <p>{t.apply.note}</p>
        {past && <p className="eyebrow">이미 지난 시기예요.</p>}
      </div>
      <div className="rule">
        <h3 className="num">
          준비 체크리스트 {done}/{t.checklist.length}
        </h3>
        <ul className="checklist">
          {t.checklist.map((c, i) => {
            const k = `${t.id}:${i}`;
            return (
              <li key={k}>
                <label>
                  <input type="checkbox" id={`chk-${k}`} checked={!!checks[k]} onChange={() => toggle(k)} />
                  <span>{c}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
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
  );
}

function Compare({ a, b, p }: { a: SchoolType; b: SchoolType; p: Profile }) {
  const rows: [string, (t: SchoolType) => ReactNode][] = [
    ["원서 시기", (t) => `${applyYear(p.birthYear, t.apply.months)}년 ${t.apply.months}`],
    ["선발 순서", (t) => t.round],
    ["지원 범위", (t) => t.scope],
    ["선발 주체", (t) => t.selectedBy],
    ["대입 경향", (t) => <Meter id={t.id} />],
    ["이런 아이에게", (t) => t.fitFor.join(", ")],
    ["주의할 점", (t) => t.watchOut.join(" / ")],
  ];
  return (
    <div className="compare-wrap">
      <table className="compare">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">{a.name}</th>
            <th scope="col">{b.name}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{f(a)}</td>
              <td>{f(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
