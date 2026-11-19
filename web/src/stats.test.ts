import { describe, expect, it } from "vitest";
import { hsAdmissionYear, isAfterReform, lastChange, niceTicks, stats, susiFor, univAdmissionYear } from "./stats";

describe("stats", () => {
  it("학년도 계산: 2012년생은 2028학년도 고입, 2031학년도 대입", () => {
    expect(hsAdmissionYear(2012)).toBe(2028);
    expect(univAdmissionYear(2012)).toBe(2031);
  });
  it("2028 개편은 2009년생부터", () => {
    expect(isAfterReform(2008)).toBe(false);
    expect(isAfterReform(2009)).toBe(true);
  });
  it("우리 아이 대입 학년도 수시 비율: 발표된 해는 그 값, 이후는 최근 발표값 + future", () => {
    const pts = stats.susiJeongsi.points;
    expect(susiFor(2009, pts)).toEqual({ point: pts.find((p) => p.year === 2028), future: false });
    expect(susiFor(2014, pts)?.future).toBe(true);
    expect(susiFor(2002, pts)).toBeNull();
  });
  it("전년 대비 변화", () => {
    const c = lastChange([
      { year: 2026, value: 3.41, status: "confirmed", sources: [] },
      { year: 2027, value: 3.38, status: "confirmed", sources: [] },
    ]);
    expect(c?.delta).toBe(-0.03);
    expect(lastChange([{ year: 2025, value: 1, status: "confirmed", sources: [] }])?.delta).toBeNull();
  });
  it("축 눈금은 0부터 최댓값을 덮는다", () => {
    expect(niceTicks(6.21)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(1.82)).toEqual([0, 0.5, 1, 1.5, 2]);
  });
  it("모든 경쟁률 수치는 출처가 있다", () => {
    for (const s of stats.hsCompetition.series) for (const p of s.points) expect(p.sources.length).toBeGreaterThan(0);
  });
});
