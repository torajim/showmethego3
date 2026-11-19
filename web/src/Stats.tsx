import { useState } from "react";
import type { Profile, YearMonth } from "./engine";
import {
  fmtRatio,
  hsAdmissionYear,
  isAfterReform,
  lastChange,
  niceTicks,
  stats,
  susiFor,
  univAdmissionYear,
  type CompetitionSeries,
  type Takeaway,
} from "./stats";
import { Sources, type SheetContent } from "./ui";

interface Props {
  p: Profile;
  now: YearMonth;
  openSheet: (s: SheetContent) => void;
}

/** 시리즈 색은 순위가 아니라 항목에 고정한다(필터로 줄어도 색이 바뀌지 않게). */
const SERIES_SLOT: Record<string, number> = { gifted: 1, science: 2, foreign: 3, "jasa-national": 4, "jasa-local": 5 };
const PANELS: { id: string; title: string; series: string[] }[] = [
  { id: "stem", title: "이공계 특목고", series: ["gifted", "science"] },
  { id: "lang", title: "외고·국제고·자사고", series: ["foreign", "jasa-national", "jasa-local"] },
];

export function StatsTab({ p, openSheet }: Props) {
  const Y = p.birthYear;
  return (
    <>
      <section className="stats-hero">
        <p className="eyebrow">숫자로 보는 입시</p>
        <h1>
          흐름을 알면
          <br />
          <em>전략이 보여요</em>
        </h1>
        <div className="stats-kid num">
          <div>
            <small>우리 아이 고입</small>
            <b>{hsAdmissionYear(Y)}학년도</b>
            <span>{hsAdmissionYear(Y) - 1}년 원서</span>
          </div>
          <div>
            <small>우리 아이 대입</small>
            <b>{univAdmissionYear(Y)}학년도</b>
            <span>{isAfterReform(Y) ? "2028 개편 적용" : "개편 전 마지막"}</span>
          </div>
        </div>
      </section>
      <Competition kidYear={hsAdmissionYear(Y)} openSheet={openSheet} />
      <SusiJeongsi birthYear={Y} />
      <Reform birthYear={Y} />
    </>
  );
}

/* ───────── 고교 유형별 경쟁률 ───────── */

function Competition({ kidYear, openSheet }: { kidYear: number; openSheet: (s: SheetContent) => void }) {
  const doc = stats.hsCompetition;
  const byId = new Map(doc.series.map((s) => [s.id, s]));
  return (
    <section className="section">
      <div className="section-head">
        <h2>{doc.title}</h2>
        <span className="eyebrow">고입 학년도 기준</span>
      </div>
      {PANELS.map((panel) => (
        <LinePanel
          key={panel.id}
          title={panel.title}
          series={panel.series.map((id) => byId.get(id)!).filter(Boolean)}
          kidYear={kidYear}
          onSeries={(s) => openSheet({ title: `${s.name} 경쟁률`, body: <SeriesDetail s={s} /> })}
        />
      ))}
      <Takeaways items={doc.takeaways} />
      <p className="eyebrow sources-note">
        {doc.basis} 속이 빈 점은 다른 해 기사에 함께 보도된 값이라 원자료를 확인하고 있어요. {doc.pending}
      </p>
    </section>
  );
}

const W = 320;
const H = 168;
const PAD = { l: 30, r: 12, t: 14, b: 26 };

function LinePanel({
  title,
  series,
  kidYear,
  onSeries,
}: {
  title: string;
  series: CompetitionSeries[];
  kidYear: number;
  onSeries: (s: CompetitionSeries) => void;
}) {
  const years = [...new Set(series.flatMap((s) => s.points.map((pt) => pt.year)))].sort((a, b) => a - b);
  const [sel, setSel] = useState<number>(years[years.length - 1]);
  const minY = Math.min(2022, years[0]);
  const maxY = Math.max(2027, years[years.length - 1]);
  const ticks = niceTicks(Math.max(...series.flatMap((s) => s.points.map((pt) => pt.value))));
  const top = ticks[ticks.length - 1];
  const x = (yr: number) => PAD.l + ((yr - minY) / (maxY - minY)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const axisYears: number[] = [];
  for (let yr = minY; yr <= maxY; yr++) axisYears.push(yr);
  const kidInRange = kidYear >= minY && kidYear <= maxY;

  return (
    <div className="chart-card">
      <div className="chart-title">
        <b>{title}</b>
        <span className="legend">
          {series.map((s) => (
            <span key={s.id}>
              <i className={`sw s${SERIES_SLOT[s.id]}`} />
              {s.name}
            </span>
          ))}
        </span>
      </div>
      <div className="readout num" aria-live="polite">
        <span className="readout-year">{sel}학년도</span>
        {series.map((s) => {
          const pt = s.points.find((q) => q.year === sel);
          return (
            <span key={s.id}>
              <i className={`sw s${SERIES_SLOT[s.id]}`} />
              {s.name} <b>{pt ? fmtRatio(pt.value) : "–"}</b>
            </span>
          );
        })}
      </div>
      <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} 연도별 평균 경쟁률. 아래 표에 같은 수치가 있어요.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {axisYears.map((yr) => (
          <text key={yr} className={`tick${yr === sel ? " on" : ""}`} x={x(yr)} y={H - 8} textAnchor="middle">
            {String(yr).slice(2)}
          </text>
        ))}
        {kidInRange && (
          <g className="kid-mark">
            <line x1={x(kidYear)} x2={x(kidYear)} y1={PAD.t - 4} y2={H - PAD.b} />
            <text x={x(kidYear)} y={PAD.t - 6} textAnchor="middle">
              우리 아이
            </text>
          </g>
        )}
        <line className="sel-line" x1={x(sel)} x2={x(sel)} y1={PAD.t} y2={H - PAD.b} />
        {series.map((s) => {
          const d = s.points.map((pt, i) => `${i ? "L" : "M"}${x(pt.year).toFixed(1)},${y(pt.value).toFixed(1)}`).join("");
          return (
            <g key={s.id} className={`series s${SERIES_SLOT[s.id]}`}>
              <path d={d} />
              {s.points.map((pt) => (
                <circle
                  key={pt.year}
                  cx={x(pt.year)}
                  cy={y(pt.value)}
                  r={pt.year === sel ? 5 : 4}
                  className={pt.status === "confirmed" ? "" : "hollow"}
                />
              ))}
            </g>
          );
        })}
        {/* 연도별 넓은 터치 영역 */}
        {axisYears.map((yr) => (
          <rect
            key={yr}
            className="hit"
            x={x(yr) - (W - PAD.l - PAD.r) / (maxY - minY) / 2}
            y={0}
            width={(W - PAD.l - PAD.r) / (maxY - minY)}
            height={H}
            onClick={() => setSel(yr)}
          />
        ))}
      </svg>
      <ul className="series-list num">
        {series.map((s) => {
          const c = lastChange(s.points);
          if (!c) return null;
          return (
            <li key={s.id}>
              <button onClick={() => onSeries(s)}>
                <i className={`sw s${SERIES_SLOT[s.id]}`} />
                <span className="sl-name">
                  <b>{s.name}</b>
                  <small>
                    {s.scope} · 원서 {s.apply}
                  </small>
                </span>
                <span className="sl-val">
                  <b>{fmtRatio(c.last.value)}</b>
                  <small>
                    {c.last.year}학년도
                    {c.delta !== null && c.delta !== 0 && (
                      <em className={c.delta > 0 ? "up" : "down"}>
                        {c.delta > 0 ? " ▲" : " ▼"}
                        {Math.abs(c.delta).toFixed(2)}
                      </em>
                    )}
                  </small>
                </span>
                <span className="chev">›</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SeriesDetail({ s }: { s: CompetitionSeries }) {
  const srcIds = [...new Set(s.points.flatMap((pt) => pt.sources))];
  return (
    <>
      <p className="eyebrow">
        {s.scope} · 원서 {s.apply}
      </p>
      <table className="data-table num">
        <thead>
          <tr>
            <th>학년도</th>
            <th>평균 경쟁률</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {s.points.map((pt) => (
            <tr key={pt.year}>
              <td>{pt.year}</td>
              <td>
                <b>{fmtRatio(pt.value)}</b> 대 1
              </td>
              <td className={pt.status}>{pt.status === "confirmed" ? "보도 확인" : "확인 중"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.points.some((pt) => pt.note) && <p className="eyebrow">확인 중: {s.points.find((pt) => pt.note)!.note}</p>}
      <p>
        경쟁률은 학교 수준이 아니라 그해 지원 열기를 보여줘요. 모집인원이 늘면 지원자가 많아도 경쟁률이 내려갈 수 있어요.
      </p>
      <Sources ids={srcIds} />
    </>
  );
}

function Takeaways({ items }: { items: Takeaway[] }) {
  return (
    <ul className="takeaways">
      {items.map((t) => (
        <li key={t.text}>
          <p>{t.text}</p>
          <Sources ids={t.sources} />
        </li>
      ))}
    </ul>
  );
}

/* ───────── 수시·정시 비율 ───────── */

function SusiJeongsi({ birthYear }: { birthYear: number }) {
  const doc = stats.susiJeongsi;
  const kid = univAdmissionYear(birthYear);
  const mine = susiFor(birthYear, doc.points);
  const latest = doc.points[doc.points.length - 1];
  const head = mine && !mine.future ? mine.point : latest;
  const of10 = Math.round(head.susi / 10);
  const srcIds = [...new Set(doc.points.flatMap((pt) => pt.sources))];
  return (
    <section className="section">
      <div className="section-head">
        <h2>{doc.title}</h2>
        <span className="eyebrow">전국 4년제</span>
      </div>
      <div className="chart-card">
        <div className="big-stat">
          <small>{head.year}학년도{mine && !mine.future ? " · 우리 아이 대입" : ""}</small>
          <p>
            10명 중 <b className="num">{of10}명</b>은 수시로 뽑아요
          </p>
          <div className="people" aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className={i < of10 ? "susi" : "jeongsi"} />
            ))}
          </div>
        </div>
        <div className="legend legend-row">
          <span>
            <i className="sw s1" />
            수시
          </span>
          <span>
            <i className="sw jeongsi" />
            정시
          </span>
        </div>
        <ol className="stack-bars num">
          {doc.points.map((pt) => (
            <li key={pt.year} className={pt.year === kid ? "kid" : ""}>
              <span className="sb-year">
                {pt.year}
                {pt.year === kid && <em>우리 아이</em>}
              </span>
              <span className="sb-bar" role="img" aria-label={`${pt.year}학년도 수시 ${pt.susi}%, 정시 ${(100 - pt.susi).toFixed(1)}%`}>
                <i className="susi" style={{ width: `${pt.susi}%` }}>
                  {pt.susi.toFixed(1)}
                </i>
                <i className="jeongsi" style={{ width: `${100 - pt.susi}%` }}>
                  {(100 - pt.susi).toFixed(1)}
                </i>
              </span>
            </li>
          ))}
          {mine?.future && (
            <li className="kid future">
              <span className="sb-year">
                {kid}
                <em>우리 아이</em>
              </span>
              <span className="sb-bar pending">아직 발표 전 · {doc.nextRelease}</span>
            </li>
          )}
        </ol>
      </div>
      <Takeaways items={doc.takeaways} />
      <p className="eyebrow sources-note">{doc.basis} 단위 %.</p>
      <div className="sources-note">
        <Sources ids={srcIds} />
      </div>
    </section>
  );
}

/* ───────── 2028 대입 개편 전후 ───────── */

function Reform({ birthYear }: { birthYear: number }) {
  const doc = stats.reform2028;
  const after = isAfterReform(birthYear);
  const srcIds = [...new Set(doc.rows.flatMap((r) => r.sources))];
  return (
    <section className="section">
      <div className="section-head">
        <h2>{doc.title}</h2>
        <span className="eyebrow">{after ? "우리 아이는 오른쪽" : "우리 아이는 왼쪽"}</span>
      </div>
      <div className="reform">
        <div className="reform-head">
          <div className={after ? "" : "mine"}>
            <b>{doc.before}</b>
            <small>{doc.beforeCohort}</small>
          </div>
          <span />
          <div className={after ? "mine" : ""}>
            <b>{doc.after}</b>
            <small>{doc.afterCohort}</small>
          </div>
        </div>
        {doc.rows.map((r) => (
          <div key={r.label} className="reform-row">
            <h3>{r.label}</h3>
            <div className="reform-cells">
              <p className={after ? "" : "mine"}>{r.before}</p>
              <span className="arrow" aria-hidden>
                →
              </span>
              <p className={after ? "mine" : ""}>{r.after}</p>
            </div>
            <small className="impact">{r.impact}</small>
          </div>
        ))}
      </div>
      <div className="sources-note">
        <Sources ids={srcIds} />
      </div>
    </section>
  );
}
