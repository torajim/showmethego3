import calendarJson from "../../data/calendar.json";
import type { SchoolType } from "./data";
import { FORK_TENDENCY, gradeAt, monthIndex, type Profile, type YearMonth } from "./engine";

export interface CalendarEvent {
  id: string;
  grades: string[];
  months: number[];
  title: string;
  todo: string;
  relates?: string;
  /** 정확한 날짜가 공표된 경우 연도별 날짜(YYYY-MM-DD) */
  exact?: Record<string, string>;
}

export const calendar = calendarJson as { note: string; events: CalendarEvent[] };

export const addMonths = (ym: YearMonth, n: number): YearMonth => {
  const i = monthIndex(ym) + n;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
};

/** 이 달에 아이 학년에 해당하는 일정. */
export function eventsIn(p: Profile, at: YearMonth, events = calendar.events): CalendarEvent[] {
  const g = gradeAt(p.birthYear, at);
  return events.filter((e) => e.grades.includes(g) && e.months.includes(at.month));
}

export interface Upcoming {
  event: CalendarEvent;
  at: YearMonth;
  grade: string;
  /** 정확한 날짜가 있으면 D-day(오늘=0), 없으면 null */
  dday: number | null;
  date?: string;
}

/**
 * 앞으로 horizon개월 안에 처음 돌아오는 일정들(이번 달 제외). 같은 일정은 가장 가까운 한 번만.
 * today는 D-day 계산용 실제 날짜.
 */
export function upcoming(p: Profile, now: YearMonth, today: Date, horizon = 12, events = calendar.events): Upcoming[] {
  const seen = new Set<string>();
  const out: Upcoming[] = [];
  for (let k = 1; k <= horizon; k++) {
    const at = addMonths(now, k);
    for (const e of eventsIn(p, at, events)) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const date = e.exact?.[String(at.year)];
      const dday = date ? daysBetween(today, localDate(date)) : null;
      out.push({ event: e, at, grade: gradeAt(p.birthYear, at), dday, date });
    }
  }
  return out;
}

const localDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** 원서 시기의 실제 연도: 중3 학년도 = 출생연도 + 15 (1·2월이면 다음 해). */
export function applyYear(birthYear: number, months: string): number {
  const first = parseInt(months, 10);
  return birthYear + 15 + (first <= 2 ? 1 : 0);
}

// ── 맞춤 추천 ────────────────────────────────────────────────

export type TrackAnswer = "stem" | "medical" | "humanities" | "job" | "unknown";
export type LevelAnswer = "top" | "high" | "mid" | "unknown";
export type StyleAnswer = "steady" | "exam" | "unknown";

export interface Answers {
  track: TrackAnswer;
  level: LevelAnswer;
  style: StyleAnswer;
  /** 학비·통학 부담을 크게 고려하는지 */
  costSensitive: boolean;
}

export const QUESTIONS = {
  track: {
    q: "아이가 관심 있는 진로는?",
    options: [
      ["stem", "이공계(수학·과학)"],
      ["medical", "의약학"],
      ["humanities", "인문·사회·어문"],
      ["job", "기술·빠른 취업"],
      ["unknown", "아직 모르겠어요"],
    ],
  },
  level: {
    q: "지금 학교 성적은 어느 정도인가요?",
    options: [
      ["top", "최상위권"],
      ["high", "상위권"],
      ["mid", "중위권"],
      ["unknown", "잘 모르겠어요"],
    ],
  },
  style: {
    q: "아이는 어떤 공부에 더 강한가요?",
    options: [
      ["steady", "꾸준히 쌓는 학교 시험(내신)"],
      ["exam", "한 번에 보는 큰 시험(수능형)"],
      ["unknown", "잘 모르겠어요"],
    ],
  },
  cost: {
    q: "학비나 통학 부담이 중요한가요?",
    options: [
      ["yes", "네, 중요해요"],
      ["no", "크게 상관없어요"],
    ],
  },
} as const;

export interface Recommendation {
  type: SchoolType;
  score: number;
  fit: "good" | "maybe" | "careful";
  reasons: string[];
}

export function recommend(types: SchoolType[], a: Answers): Recommendation[] {
  const recs = types.map((type) => {
    let score = 50;
    const reasons: string[] = [];
    const add = (n: number, why: string) => {
      score += n;
      reasons.push(why);
    };
    switch (type.id) {
      case "gifted":
        if (a.track === "stem" && a.level === "top") add(35, "수학·과학 최상위권에게 맞는 학교예요.");
        else if (a.track === "stem") add(5, "이공계 진로와 맞지만 선발 경쟁이 매우 치열해요.");
        if (a.track === "medical") add(-35, "의약학 진학 시 불이익 규정을 둔 학교가 많아요.");
        if (a.level === "mid") add(-30, "최상위권 위주로 선발해요.");
        if (a.track === "humanities" || a.track === "job") add(-30, "수학·과학 중심 학교예요.");
        break;
      case "science":
        if (a.track === "stem") add(30, "이공계 진로에 맞춘 교육과정이에요.");
        if (a.level === "top" || a.level === "high") add(10, "수학·과학 성취도가 높을수록 유리해요.");
        if (a.level === "mid") add(-15, "수학·과학 상위권 위주로 선발해요.");
        if (a.track === "medical") add(-25, "의약학 진학을 제한하는 학교 방침이 있을 수 있어요.");
        if (a.track === "humanities" || a.track === "job") add(-30, "수학·과학 중심 학교예요.");
        break;
      case "foreign-language-international":
        if (a.track === "humanities") add(30, "어문·국제·인문사회 진로에 맞는 학교예요.");
        if (a.level === "top" || a.level === "high") add(5, "영어 성취도가 중요해요.");
        if (a.track === "stem" || a.track === "medical") add(-15, "이공계·의약학 과목 개설이 일반고보다 적을 수 있어요.");
        if (a.style === "steady") add(-10, "우수 학생이 모여 내신 경쟁이 치열할 수 있어요.");
        if (a.costSensitive) add(-10, "학비가 일반고보다 높은 편이에요.");
        break;
      case "autonomous-private":
        if (a.style === "exam") add(20, "수능(정시) 중심 전략과 잘 맞는 경향이 있어요.");
        if (a.style === "steady") add(-15, "우수 학생 밀집으로 내신이 불리할 수 있어요.");
        if (a.level === "top" || a.level === "high") add(10, "학업 분위기를 중시하는 상위권이 많이 지원해요.");
        if (a.costSensitive) add(-25, "학비 부담이 일반고보다 커요.");
        if (a.track === "job") add(-20, "대학 진학 중심 학교예요.");
        break;
      case "general":
        if (a.style === "steady") add(25, "내신을 잘 받으면 학생부교과·종합전형에 유리해요.");
        if (a.track === "medical") add(10, "의약학 수시는 내신이 핵심이라 일반고 상위권 전략이 많이 쓰여요.");
        if (a.level === "mid" || a.level === "unknown") add(10, "대부분의 학생에게 무난한 선택이에요.");
        if (a.costSensitive) add(10, "학비 부담이 적고 가까운 학교로 배정돼요.");
        break;
      case "vocational":
        if (a.track === "job") add(40, "기술을 배우고 빨리 취업하는 진로에 맞는 학교예요.");
        else add(-25, "대학 진학보다 취업 중심 교육과정이에요.");
        if (a.costSensitive) add(5, "학비 지원이 많은 편이에요.");
        break;
    }
    if (reasons.length === 0) reasons.push("답변만으로는 뚜렷한 장단점이 없어요. 학교별로 비교해 보세요.");
    score = Math.max(0, Math.min(100, score));
    const fit: Recommendation["fit"] = score >= 70 ? "good" : score >= 45 ? "maybe" : "careful";
    return { type, score, fit, reasons };
  });
  return recs.sort((x, y) => y.score - x.score || (FORK_TENDENCY[x.type.id] ?? 50) - (FORK_TENDENCY[y.type.id] ?? 50));
}

// ── 지난 방문 이후 새 소식 ───────────────────────────────────

export function newSince<T extends { date: string }>(items: T[], lastVisitIso: string | null): T[] {
  if (!lastVisitIso) return [];
  return items.filter((i) => i.date > lastVisitIso);
}
