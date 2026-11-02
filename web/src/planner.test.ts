import { describe, expect, it } from "vitest";
import { schoolTypes } from "./data";
import type { Profile } from "./engine";
import { addMonths, applyYear, eventsIn, newSince, recommend, upcoming, type Answers } from "./planner";

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
