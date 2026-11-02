import { meta, news, type NewsItem } from "./data";
import { gradeAt, regionScore, type Profile, type YearMonth } from "./engine";
import { calendar, eventsIn, upcoming } from "./planner";

/** 이번 달 할 일 + 다가오는 일정. 들어올 때마다 달이 바뀌면 내용이 바뀐다. */
export function ThisMonth({ p, now, today }: { p: Profile; now: YearMonth; today: Date }) {
  const g = gradeAt(p.birthYear, now);
  const current = eventsIn(p, now);
  const next = upcoming(p, now, today, 12).slice(0, 4);
  return (
    <section className="month">
      <p className="eyebrow">
        {now.month}월 · {g}
      </p>
      <h2>이번 달 챙길 것</h2>
      {current.length ? (
        <ul className="todo">
          {current.map((e) => (
            <li key={e.id}>
              <b>{e.title}</b>
              <span>{e.todo}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="todo-empty">이번 달은 큰 일정이 없어요. 아래 노선도에서 다음 역을 미리 살펴보세요.</p>
      )}
      {next.length > 0 && (
        <>
          <h3 className="month-sub">다가오는 일정</h3>
          <ul className="soon num">
            {next.map((u) => (
              <li key={u.event.id}>
                <span className="soon-when">{u.dday !== null ? (u.dday === 0 ? "D-DAY" : `D-${u.dday}`) : `${u.at.year}.${u.at.month}`}</span>
                <span className="soon-what">{u.event.title}</span>
                <span className="soon-grade">{u.grade}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="eyebrow">{calendar.note}</p>
    </section>
  );
}

export interface WhatsNewItem {
  key: string;
  label: string;
  text: string;
  url?: string;
}

/** 지난 방문 이후 새로 바뀐 제도 안내와 우리 지역·공식 뉴스. 첫 방문이면 비어 있다. */
export function whatsNew(p: Profile, lastVisit: string | null): WhatsNewItem[] {
  if (!lastVisit) return [];
  const changes = meta.changes
    .filter((c) => c.date > lastVisit.slice(0, 10))
    .map((c, i) => ({ key: `c${i}`, label: "서비스 업데이트", text: c.text }));
  const items = news.items
    .filter((n: NewsItem) => n.publishedAt > lastVisit && (n.official || regionScore(n, p) >= 2))
    .slice(0, 8)
    .map((n) => ({ key: n.id, label: n.official ? "공식 발표" : "우리 지역 뉴스", text: n.title, url: n.url }));
  return [...changes, ...items];
}

export function WhatsNewList({ items }: { items: WhatsNewItem[] }) {
  return (
    <ul className="news">
      {items.map((i) => (
        <li key={i.key}>
          {i.url ? (
            <a href={i.url} target="_blank" rel="noopener noreferrer">
              <span className="news-meta">{i.label}</span>
              <b>{i.text}</b>
            </a>
          ) : (
            <div className="news-static">
              <span className="news-meta">{i.label}</span>
              <b>{i.text}</b>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
