import { useState } from "react";
import { meta, sourceById } from "./data";
import type { Profile } from "./engine";
import {
  FIVE_GRADE_SHARES,
  faqIsMine,
  guide,
  reformApplies,
  searchTerms,
  sortFaq,
  type Faq,
  type ReformCard,
} from "./guide";
import { Sources, type SheetContent } from "./ui";

type LinkTab = NonNullable<Faq["link"]>;
const LINK_LABEL: Record<LinkTab, string> = {
  fork: "갈림길에서 고교 유형 비교하기",
  stats: "통계 탭에서 숫자로 보기",
  school: "우리 지역 학교 보기",
  route: "노선도 보기",
  news: "최신 뉴스 보기",
};

interface Props {
  p: Profile;
  openSheet: (s: SheetContent) => void;
  goTab: (t: LinkTab) => void;
}

export function GuideTab({ p, openSheet, goTab }: Props) {
  const Y = p.birthYear;
  const mine = guide.reforms.filter((c) => reformApplies(c, Y)).length;
  return (
    <>
      <section className="stats-hero">
        <p className="eyebrow">입시 제도 쉽게 이해하기</p>
        <h1>
          바뀐 제도,
          <br />
          <em>카드 한 장</em>이면 돼요
        </h1>
        <p className="guide-kid">
          {mine === guide.reforms.length ? (
            <>
              <b>{Y}년생</b>은 아래 세 가지 변화가 <b>모두 해당</b>돼요.
            </>
          ) : (
            <>
              <b>{Y}년생</b>은 개편 전 제도로 대입을 치르는 <b>마지막 세대</b>예요. 재수하면 아래 제도를 만나요.
            </>
          )}
        </p>
      </section>
      <p className="guide-warn" role="note">
        <b>참고용, 개별 확인 필요</b>
        <span>공개 자료를 쉽게 풀어 쓴 내용이에요. 대학·교육청의 공식 모집요강과 학교 선생님을 통해 꼭 확인하세요.</span>
      </p>

      <section className="section">
        <div className="section-head">
          <h2>꼭 알아야 할 변화 3가지</h2>
          <span className="eyebrow">눌러서 자세히</span>
        </div>
        {guide.reforms.map((c, i) => (
          <ReformCardView key={c.id} c={c} n={i + 1} mine={reformApplies(c, Y)} onOpen={() => openSheet(reformSheet(c))} />
        ))}
      </section>

      <FaqSection Y={Y} goTab={goTab} />
      <Glossary />
      <p className="eyebrow sources-note">자료 기준일 {guide.lastReviewed.split("-").join(".")}. 제도는 해마다 바뀔 수 있어요.</p>
    </>
  );
}

/* ───────── 제도 카드 ───────── */

function ReformCardView({ c, n, mine, onOpen }: { c: ReformCard; n: number; mine: boolean; onOpen: () => void }) {
  return (
    <button className="reform-card" onClick={onOpen}>
      <span className="rc-top">
        <span className="rc-n num">{n}</span>
        <span className="rc-title">{c.title}</span>
        {mine ? <span className="tag alert">우리 아이 해당</span> : <span className="tag">재수 시 해당</span>}
      </span>
      <span className="rc-one">{c.oneLine}</span>
      <span className="rc-big">
        {c.big.before && (
          <>
            <s>{c.big.before}</s>
            <span aria-hidden>→</span>
          </>
        )}
        <b>{c.big.after}</b>
      </span>
      <Visual kind={c.visual} />
      <span className="rc-foot">
        <small>{c.fromLabel}</small>
        <span className="chev">자세히 ›</span>
      </span>
    </button>
  );
}

function Visual({ kind }: { kind: ReformCard["visual"] }) {
  if (kind === "grades") {
    let acc = 0;
    return (
      <span className="viz" aria-label="내신 1등급 비율: 9등급제 상위 4%, 5등급제 상위 10%">
        <span className="viz-row">
          <small>9등급제</small>
          <span className="bar">
            <i className="seg hi" style={{ width: "4%" }} />
            <i className="seg rest" style={{ width: "96%" }} />
          </span>
          <small className="num">1등급 4%</small>
        </span>
        <span className="viz-row">
          <small>5등급제</small>
          <span className="bar">
            {FIVE_GRADE_SHARES.map((v, i) => (
              <i key={i} className={`seg g${i + 1}`} style={{ width: `${v}%` }} title={`${i + 1}등급 ${v}%`} />
            ))}
          </span>
          <small className="num">1등급 10%</small>
        </span>
        <span className="viz-legend num">
          {FIVE_GRADE_SHARES.map((v, i) => {
            acc += v;
            return (
              <span key={i}>
                <i className={`sw g${i + 1}`} />
                {i + 1}등급 ~{acc}%
              </span>
            );
          })}
        </span>
      </span>
    );
  }
  if (kind === "credits") {
    return (
      <span className="viz" aria-label="졸업 192학점: 교과 174학점, 창의적 체험활동 18학점">
        <span className="bar tall">
          <i className="seg g1" style={{ width: `${(174 / 192) * 100}%` }}>
            교과 174
          </i>
          <i className="seg cr" style={{ width: `${(18 / 192) * 100}%` }} title="창의적 체험활동 18학점" />
        </span>
        <span className="viz-legend num">
          <span>
            <i className="sw g1" />
            교과 174학점
          </span>
          <span>
            <i className="sw cr" />
            창의적 체험활동 18학점
          </span>
          <span>1학점 = 한 학기 16회 수업</span>
        </span>
      </span>
    );
  }
  return (
    <span className="viz csat" aria-label="수능 과목: 국어·수학·탐구 선택과목 폐지">
      {[
        ["국어", "2개 중 택1", "공통"],
        ["수학", "3개 중 택1", "공통"],
        ["탐구", "17과목 중 택2", "통합사회+통합과학"],
      ].map(([area, before, after]) => (
        <span key={area} className="csat-row">
          <b>{area}</b>
          <s>{before}</s>
          <span aria-hidden>→</span>
          <em>{after}</em>
        </span>
      ))}
    </span>
  );
}

function reformSheet(c: ReformCard): SheetContent {
  return {
    title: c.title,
    body: (
      <>
        <p>{c.oneLine}</p>
        <div className="rule">
          <span className={`status ${c.status}`}>{meta.statusLabels[c.status]}</span>
          <small className="eyebrow">{c.fromLabel}</small>
          <ul className="points">
            {c.points.map((pt) => (
              <li key={pt.label}>
                <b>{pt.label}</b>
                <span>{pt.text}</span>
              </li>
            ))}
          </ul>
          <p className="tip">{c.tip}</p>
          <Sources ids={c.sources} />
        </div>
      </>
    ),
  };
}

/* ───────── 자주 묻는 질문 ───────── */

function FaqSection({ Y, goTab }: { Y: number; goTab: (t: LinkTab) => void }) {
  const list = sortFaq(guide.faq, Y);
  return (
    <section className="section">
      <div className="section-head">
        <h2>자주 묻는 질문</h2>
        <span className="eyebrow num">{list.length}개</span>
      </div>
      <div className="faq">
        {list.map((f) => (
          <details key={f.id}>
            <summary>
              <span className="q">Q</span>
              <span className="faq-q">
                {faqIsMine(f, Y) && <span className="tag alert">우리 아이</span>}
                {f.q}
              </span>
            </summary>
            <div className="faq-a">
              <p className="lead">{f.a}</p>
              <ul className="points">
                {f.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
              {f.tip && <p className="tip">{f.tip}</p>}
              {f.link && (
                <button className="ghost link" onClick={() => goTab(f.link!)}>
                  {LINK_LABEL[f.link]} ›
                </button>
              )}
              <Sources ids={f.sources} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ───────── 입시 용어 사전 ───────── */

function Glossary() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const list = searchTerms(guide.terms, q, group);
  return (
    <section className="section">
      <div className="section-head">
        <h2>입시 용어 사전</h2>
        <span className="eyebrow num">{guide.terms.length}개</span>
      </div>
      <input
        className="search"
        type="search"
        placeholder="예: 학종, 수능 최저, 세특"
        aria-label="입시 용어 찾기"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="filters" aria-label="용어 분류">
        {[null, ...guide.termGroups].map((g) => (
          <button key={g ?? "all"} className="filter" aria-pressed={group === g} onClick={() => setGroup(g)}>
            {g ?? "전체"}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <b>찾는 용어가 없어요</b>
          <p>다른 말로 찾거나 분류를 '전체'로 바꿔 보세요.</p>
        </div>
      ) : (
        <dl className="gloss">
          {list.map((t) => (
            <div key={t.term}>
              <dt>
                {t.term}
                {t.aka && <small> · {t.aka}</small>}
              </dt>
              <dd>{t.text}</dd>
              <dd className="src-inline">
                근거{" "}
                {t.sources.map((id, i) => {
                  const s = sourceById.get(id);
                  if (!s) return null;
                  return (
                    <span key={id}>
                      {i > 0 && " · "}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}>
                        {s.publisher}
                      </a>
                    </span>
                  );
                })}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
