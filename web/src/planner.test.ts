import { describe, expect, it } from "vitest";
import { schoolTypes } from "./data";
import type { Profile } from "./engine";
import { rules } from "./data";
import { buildStops } from "./engine";
import {
  addMonths,
  applyYear,
  countdown,
  eventsIn,
  exactDate,
  formatDate,
  newSince,
  recommend,
  stopDate,
  upcoming,
  type Answers,
} from "./planner";

const p = (birthYear: number): Profile => ({ birthYear, birthMonth: 5, region: "gyeonggi", district: "용인" });

describe("calendar", () => {
  it("addMonths는 해를 넘긴다", () => {
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({ year: 2027, month: 2 });
  });
  it("중2 11월에는 기말고사와 고입 설명회 시즌", () => {
    const ids = eventsIn(p(2012), { year: 2026, month: 11 }).map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["final2", "hs-info"]));
    expect(ids).not.toContain("hs-apply");
  });
  it("다가오는 일정은 이번 달을 빼고 가까운 순, 같은 일정은 한 번", () => {
    const list = upcoming(p(2012), { year: 2026, month: 11 }, new Date("2026-11-02T09:00:00+09:00"));
    const ids = list.map((u) => u.event.id);
    expect(ids[0]).toBe("final2"); // 12월
    expect(new Set(ids).size).toBe(ids.length);
    // 2027년 3월부터 중3이므로 영재학교 원서 시즌이 들어간다
    expect(list.find((u) => u.event.id === "gifted-apply")).toMatchObject({ at: { year: 2027, month: 3 }, grade: "중3" });
  });
  it("정확한 날짜가 있으면 D-day", () => {
    const events = [{ id: "csat", grades: ["고3"], months: [11], title: "수능", todo: "", exact: { "2026": "2026-11-19" } }];
    const list = upcoming(p(2008), { year: 2026, month: 10 }, new Date("2026-10-31T09:00:00+09:00"), 12, events);
    expect(list[0].dday).toBe(19);
  });
  it("원서 연도", () => {
    expect(applyYear(2012, "8~9월")).toBe(2027);
    expect(applyYear(2012, "12월 초")).toBe(2027);
  });
});

describe("recommend", () => {
  const ans = (a: Partial<Answers>): Answers => ({ track: "unknown", level: "unknown", style: "unknown", costSensitive: false, ...a });
  it("이공계 최상위권은 영재학교·과학고가 위", () => {
    const top2 = recommend(schoolTypes, ans({ track: "stem", level: "top" })).slice(0, 2).map((r) => r.type.id);
    expect(top2.sort()).toEqual(["gifted", "science"]);
  });
  it("의약학 + 내신형 + 학비 부담은 일반고가 1순위", () => {
    const r = recommend(schoolTypes, ans({ track: "medical", style: "steady", costSensitive: true }));
    expect(r[0].type.id).toBe("general");
    expect(r[0].fit).toBe("good");
    expect(r.find((x) => x.type.id === "gifted")!.fit).toBe("careful");
  });
  it("기술·취업은 특성화고가 1순위", () => {
    expect(recommend(schoolTypes, ans({ track: "job" }))[0].type.id).toBe("vocational");
  });
  it("모든 추천에 이유가 하나 이상", () => {
    for (const r of recommend(schoolTypes, ans({}))) expect(r.reasons.length).toBeGreaterThan(0);
  });
});

describe("newSince", () => {
  it("첫 방문이면 비어 있고, 이후에는 더 새로운 것만", () => {
    const items = [{ date: "2026-11-01" }, { date: "2026-11-03" }];
    expect(newSince(items, null)).toEqual([]);
    expect(newSince(items, "2026-11-02")).toEqual([{ date: "2026-11-03" }]);
  });
});

describe("D-day 타임라인", () => {
  const seoul = (birthYear: number): Profile => ({ birthYear, birthMonth: 5, region: "seoul", district: null });
  it("경기 전용 일정은 서울에 나오지 않는다", () => {
    const at = { year: 2026, month: 8 };
    expect(eventsIn(p(2013), at).map((e) => e.id)).toContain("gg-grade-start");
    expect(eventsIn(seoul(2013), at).map((e) => e.id)).not.toContain("gg-grade-start");
  });
  it("2027년부터 하반기 모의평가는 8월", () => {
    expect(eventsIn(p(2009), { year: 2027, month: 8 }).map((e) => e.id)).toContain("mock-kice-aug");
    expect(eventsIn(p(2009), { year: 2027, month: 9 }).map((e) => e.id)).not.toContain("mock-kice");
    expect(eventsIn(p(2008), { year: 2026, month: 9 }).map((e) => e.id)).toContain("mock-kice");
  });
  it("발표된 날짜에는 근거가 붙는다", () => {
    expect(exactDate("csat", 2027)).toMatchObject({ date: "2027-11-18" });
    expect(exactDate("csat", 2027)!.sources.length).toBeGreaterThan(0);
    expect(exactDate("csat", 2030)).toBeNull();
  });
  it("2008년생 수능은 2026.11.18 기준 D-1, 정시 원서도 날짜가 있다", () => {
    const today = new Date(2026, 10, 18);
    const now = { year: 2026, month: 11 };
    const stops = buildStops(p(2008), rules);
    const csat = stops.find((s) => s.key === "csat")!;
    expect(countdown(csat, stopDate(csat), now, today)).toMatchObject({ label: "D-1", exact: true, passed: false });
    const jeongsi = stops.find((s) => s.key === "jeongsi")!;
    expect(stopDate(jeongsi)?.date).toBe("2027-01-04");
  });
  it("날짜가 없으면 개월 수로", () => {
    const stops = buildStops(p(2012), rules);
    const apply = stops.find((s) => s.key === "high-apply")!;
    const c = countdown(apply, stopDate(apply), { year: 2026, month: 11 }, new Date(2026, 10, 18));
    expect(c).toMatchObject({ label: "1년", exact: false, passed: false });
  });
  it("초6이 될 아이는 중학교 배정 원서 역이 있다", () => {
    const s = buildStops(p(2015), rules).find((x) => x.key === "middle-apply")!;
    expect([s.year, s.month]).toEqual([2027, 12]);
  });
  it("요일 포함 날짜", () => {
    expect(formatDate("2026-11-19")).toBe("2026.11.19 (목)");
  });
});
