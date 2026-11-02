import { useEffect, useMemo, useState } from "react";
import type { Profile, YearMonth } from "./engine";
import {
  SORTS,
  areasFor,
  average,
  defaultLevel,
  loadSchools,
  mapUrl,
  netMove,
  schoolInfoUrl,
  shortName,
  sortSchools,
  type Level,
  type School,
  type SchoolsDoc,
  type SortKey,
} from "./schools";
import { KEYS, readJson, writeJson } from "./storage";
import type { SheetContent } from "./ui";

interface Props {
  p: Profile;
  now: YearMonth;
  openSheet: (s: SheetContent) => void;
}

const KINDS = ["전체", "일반고", "자율고", "특목고", "특성화고"];

export function SchoolsSection({ p, now, openSheet }: Props) {
  const [doc, setDoc] = useState<SchoolsDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const [level, setLevel] = useState<Level>(() => defaultLevel(p, now));
  const [area, setArea] = useState<string | null>(() => readJson<string | null>(KEYS.schoolArea, null));
  const [kind, setKind] = useState("전체");
  const [sort, setSort] = useState<SortKey>("students");
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    loadSchools().then(setDoc, () => setFailed(true));
  }, []);

  const regional = useMemo(() => doc?.schools.filter((s) => s.region === p.region) ?? [], [doc, p.region]);
  const { mine, others } = useMemo(() => {
    const all = [...new Set(regional.map((s) => s.area))];
    return areasFor(p, all);
  }, [regional, p]);
  const allAreas = [...mine, ...others];
  const current = area && allAreas.includes(area) ? area : allAreas[0] ?? null;

  const list = useMemo(() => {
    const xs = regional.filter((s) => s.area === current && s.level === level && (kind === "전체" || s.kind === kind));
    return sortSchools(xs, sort);
  }, [regional, current, level, kind, sort]);
  const maxStudents = Math.max(1, ...list.map((s) => s.students ?? 0));

  const chooseArea = (a: string) => {
    setArea(a);
    writeJson(KEYS.schoolArea, a);
    setPicked([]);
  };
  const toggle = (code: string) =>
    setPicked((xs) => (xs.includes(code) ? xs.filter((x) => x !== code) : [...xs, code].slice(-2)));
  const byCode = (c: string) => regional.find((s) => s.code === c)!;

  if (failed) return null;
  if (!doc) {
    return (
      <section className="section">
        <div className="section-head">
          <h2>우리 동네 학교</h2>
        </div>
        <div className="school-empty">학교 정보를 불러오는 중이에요.</div>
      </section>
    );
  }
  if (!regional.length) {
    return (
      <section className="section">
        <div className="section-head">
          <h2>우리 동네 학교</h2>
        </div>
        <div className="school-empty">학교알리미 공시 정보를 준비하고 있어요. 곧 우리 지역 중·고등학교를 비교해 볼 수 있어요.</div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="section-head">
        <h2>우리 동네 학교</h2>
        <span className="eyebrow">{doc.pbanYear}년 공시</span>
      </div>

      <div className="seg" role="tablist" aria-label="학교급">
        {(["middle", "high"] as Level[]).map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={level === l}
            onClick={() => {
              setLevel(l);
              setKind("전체");
              setPicked([]);
            }}
          >
            {l === "middle" ? "중학교" : "고등학교"}
          </button>
        ))}
      </div>

      <div className="area-chips" aria-label="지역">
        {allAreas.map((a) => (
          <button
            key={a}
            className={`filter${mine.includes(a) ? " mine" : ""}`}
            aria-pressed={a === current}
            onClick={() => chooseArea(a)}
          >
            {a}
          </button>
        ))}
      </div>

      {level === "high" && (
        <div className="filters">
          {KINDS.map((k) => (
            <button key={k} className="filter" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
      )}

      <AreaSummary list={list} area={current ?? ""} level={level} />

      <label className="sort">
        <span className="sr-only">정렬</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          {SORTS.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {list.length === 0 ? (
        <div className="school-empty">조건에 맞는 학교가 없어요.</div>
      ) : (
        <ul className="schools">
          {list.map((s) => (
            <li key={s.code} className={picked.includes(s.code) ? "picked" : ""}>
              <button className="school-open" onClick={() => openSheet({ title: s.name, body: <SchoolDetail s={s} peers={list} /> })}>
                <span className="school-name">{s.name}</span>
                <Tags s={s} />
                <span className="school-bar" aria-hidden>
                  <i style={{ width: `${((s.students ?? 0) / maxStudents) * 100}%` }} />
                </span>
                <span className="school-stats num">
                  <span>
                    학생 <b>{fmt(s.students)}</b>명
                  </span>
                  <span>
                    학급당 <b>{fmt(s.perClass)}</b>명
                  </span>
                  <span>
                    교원 1인당 <b>{fmt(s.perTeacher)}</b>명
                  </span>
                </span>
              </button>
              <button className="pick-toggle" aria-pressed={picked.includes(s.code)} aria-label={`${s.name} 비교에 담기`} onClick={() => toggle(s.code)}>
                {picked.includes(s.code) ? "✓" : "+"}
                <small>비교</small>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="eyebrow sources-note">
        출처:{" "}
        <a href={doc.source.url} target="_blank" rel="noopener noreferrer">
          {doc.source.title}
        </a>{" "}
        ({doc.source.license}). 학교 서열이 아니라 규모와 여건을 보여주는 정보예요.
      </p>

      {picked.length > 0 && (
        <>
          <div className="compare-bar">
            <span>
              {picked.map((c) => shortName(byCode(c).name)).join(" vs ")}
              {picked.length < 2 && " · 하나 더 골라주세요"}
            </span>
            <button
              className="compare-go"
              disabled={picked.length < 2}
              onClick={() =>
                openSheet({ title: "학교 나란히 비교", body: <SchoolCompare a={byCode(picked[0])} b={byCode(picked[1])} /> })
              }
            >
              비교하기
            </button>
          </div>
          <div className="compare-space" aria-hidden="true" />
        </>
      )}
    </section>
  );
}

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v.toLocaleString("ko-KR"));

function Tags({ s }: { s: School }) {
  const tags = [s.kind, s.found, s.coed].filter((x): x is string => !!x);
  return (
    <span className="school-tags">
      {tags.map((t) => (
        <span key={t} className={t === s.kind ? "kind" : ""}>
          {t}
        </span>
      ))}
    </span>
  );
}

function AreaSummary({ list, area, level }: { list: School[]; area: string; level: Level }) {
  const total = list.reduce((a, s) => a + (s.students ?? 0), 0);
  return (
    <div className="area-sum num">
      <div>
        <span>{area}</span>
        <b>
          {list.length}
          <small>곳</small>
        </b>
        <em>{level === "middle" ? "중학교" : "고등학교"}</em>
      </div>
      <div>
        <span>학생 수 합계</span>
        <b>
          {fmt(total)}
          <small>명</small>
        </b>
      </div>
      <div>
        <span>평균 학급당</span>
        <b>
          {fmt(average(list, "perClass"))}
          <small>명</small>
        </b>
      </div>
    </div>
  );
}

function SchoolDetail({ s, peers }: { s: School; peers: School[] }) {
  const avgClass = average(peers, "perClass");
  const avgTeacher = average(peers, "perTeacher");
  const net = netMove(s);
  const gradeMax = Math.max(1, ...s.byGrade.map((g) => g ?? 0));
  return (
    <>
      <Tags s={s} />
      {s.addr && <p className="eyebrow">{s.addr}</p>}
      <div className="detail-grid num">
        <Stat label="전체 학생" value={s.students} unit="명" />
        <Stat label="학급 수" value={s.classes} unit="개" />
        <Stat label="학급당 학생" value={s.perClass} unit="명" note={avgClass !== null ? `지역 평균 ${avgClass}명` : undefined} />
        <Stat label="교원 1인당 학생" value={s.perTeacher} unit="명" note={avgTeacher !== null ? `지역 평균 ${avgTeacher}명` : undefined} />
        <Stat label="동아리" value={s.clubs} unit="개" />
        <Stat
          label="전입 − 전출"
          value={s.moveIn !== null && s.moveOut !== null ? s.moveIn - s.moveOut : null}
          unit="명"
          signed
          note={net !== null ? `학생 100명당 ${net > 0 ? "+" : ""}${net}명` : undefined}
        />
      </div>
      <div className="rule">
        <h3>학년별 학생 수</h3>
        <div className="grade-bars num">
          {s.byGrade.map((g, i) => (
            <div key={i}>
              <span>{i + 1}학년</span>
              <span className="gb">
                <i style={{ width: `${((g ?? 0) / gradeMax) * 100}%` }} />
              </span>
              <b>{fmt(g)}</b>
            </div>
          ))}
        </div>
        <p className="eyebrow">전입·전출은 지난 학년도 기준이에요. 이사·학군 수요를 짐작하는 참고치일 뿐 학교의 질을 뜻하지 않아요.</p>
      </div>
      <div className="link-row">
        <a className="ghost-link" href={schoolInfoUrl(s)} target="_blank" rel="noopener noreferrer">
          학교알리미 원문 ›
        </a>
        {s.url && (
          <a className="ghost-link" href={s.url} target="_blank" rel="noopener noreferrer">
            학교 홈페이지 ›
          </a>
        )}
        <a className="ghost-link" href={mapUrl(s)} target="_blank" rel="noopener noreferrer">
          지도 ›
        </a>
      </div>
    </>
  );
}

function Stat({ label, value, unit, note, signed }: { label: string; value: number | null; unit: string; note?: string; signed?: boolean }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>
        {signed && value !== null && value > 0 ? "+" : ""}
        {fmt(value)}
        <small>{unit}</small>
      </b>
      {note && <em>{note}</em>}
    </div>
  );
}

/** 두 학교를 가운데 축 기준 좌우 막대(나비 차트)로 비교한다. */
function SchoolCompare({ a, b }: { a: School; b: School }) {
  const rows: [string, number | null, number | null, string, string?][] = [
    ["전체 학생", a.students, b.students, "명"],
    ["학급 수", a.classes, b.classes, "개"],
    ["학급당 학생", a.perClass, b.perClass, "명", "적을수록 한 반이 여유로워요"],
    ["교원 1인당 학생", a.perTeacher, b.perTeacher, "명", "적을수록 선생님 한 분이 맡는 학생이 적어요"],
    ["1학년", a.byGrade[0], b.byGrade[0], "명"],
    ["2학년", a.byGrade[1], b.byGrade[1], "명"],
    ["3학년", a.byGrade[2], b.byGrade[2], "명"],
    ["동아리", a.clubs, b.clubs, "개"],
    ["전입", a.moveIn, b.moveIn, "명"],
    ["전출", a.moveOut, b.moveOut, "명"],
  ];
  const facts: [string, string | null, string | null][] = [
    ["유형", a.kind ?? (a.level === "middle" ? "중학교" : null), b.kind ?? (b.level === "middle" ? "중학교" : null)],
    ["설립", a.found, b.found],
    ["남녀공학", a.coed, b.coed],
    ["지역", a.area, b.area],
  ];
  return (
    <div className="vs">
      <div className="vs-head">
        <div className="vs-a">
          <i />
          <b>{shortName(a.name)}</b>
        </div>
        <span className="vs-mid">VS</span>
        <div className="vs-b">
          <i />
          <b>{shortName(b.name)}</b>
        </div>
      </div>

      <dl className="vs-facts">
        {facts.map(([k, x, y]) => (
          <div key={k}>
            <dd className={x === y ? "same" : ""}>{x ?? "–"}</dd>
            <dt>{k}</dt>
            <dd className={x === y ? "same" : ""}>{y ?? "–"}</dd>
          </div>
        ))}
      </dl>

      <div className="vs-rows num">
        {rows.map(([label, x, y, unit, hint]) => {
          const max = Math.max(1, x ?? 0, y ?? 0);
          return (
            <div key={label} className="vs-row">
              <div className="vs-label">
                <span>{label}</span>
                {hint && <small>{hint}</small>}
              </div>
              <div className="vs-bars">
                <span className="vs-val a">
                  {fmt(x)}
                  <small>{unit}</small>
                </span>
                <span className="vs-bar a">
                  <i style={{ width: `${((x ?? 0) / max) * 100}%` }} />
                </span>
                <span className="vs-bar b">
                  <i style={{ width: `${((y ?? 0) / max) * 100}%` }} />
                </span>
                <span className="vs-val b">
                  {fmt(y)}
                  <small>{unit}</small>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="eyebrow">학교알리미 공시 수치예요. 학교의 좋고 나쁨이 아니라 규모와 여건을 비교하는 참고 자료로 봐 주세요.</p>
      <div className="link-row">
        <a className="ghost-link" href={schoolInfoUrl(a)} target="_blank" rel="noopener noreferrer">
          {shortName(a.name)} 원문 ›
        </a>
        <a className="ghost-link" href={schoolInfoUrl(b)} target="_blank" rel="noopener noreferrer">
          {shortName(b.name)} 원문 ›
        </a>
      </div>
    </div>
  );
}
