import { describe, expect, it } from "vitest";
import { rules } from "./data";
import {
  buildStops,
  formatRemaining,
  gradeAt,
  generationTags,
  herePosition,
  nearStages,
  relativeDay,
  type Profile,
} from "./engine";

const gg = (birthYear: number, district = "용인"): Profile => ({ birthYear, birthMonth: 5, region: "gyeonggi", district });
const seoul = (birthYear: number): Profile => ({ birthYear, birthMonth: 5, region: "seoul", district: null });

describe("gradeAt", () => {
  it("학년은 3월에 바뀐다", () => {
    expect(gradeAt(2012, { year: 2026, month: 11 })).toBe("중2");
    expect(gradeAt(2009, { year: 2027, month: 2 })).toBe("고2");
    expect(gradeAt(2009, { year: 2027, month: 3 })).toBe("고3");
    expect(gradeAt(2020, { year: 2026, month: 11 })).toBe("미취학");
  });
});

describe("buildStops", () => {
  it("2012년생 경기 용인: 중1 2학기 반영과 평준화 규칙이 들어간다", () => {
    const stops = buildStops(gg(2012), rules);
    expect(stops.map((s) => s.key)).toContain("middle-grade-start");
    const apply = stops.find((s) => s.key === "high-apply")!;
    expect(apply.year).toBe(2027);
    expect(apply.rules.map((r) => r.id)).toContain("gyeonggi-equalized-hs");
    expect(stops.find((s) => s.key === "csat")!.title).toBe("2031학년도 수능");
  });

  it("경기 비평준화 지역은 비평준화 규칙을 쓴다", () => {
    const ids = buildStops(gg(2012, "그 외 지역"), rules).find((s) => s.key === "high-apply")!.rules.map((r) => r.id);
    expect(ids).toContain("gyeonggi-non-equalized");
    expect(ids).not.toContain("gyeonggi-equalized-hs");
  });

  it("서울은 경기 전용 역이 없다", () => {
    const stops = buildStops(seoul(2012), rules);
    expect(stops.map((s) => s.key)).not.toContain("middle-grade-start");
    expect(stops.find((s) => s.key === "high-apply")!.rules.map((r) => r.id)).toContain("seoul-hs-absolute-grade");
  });

  it("2008년생은 선택형 수능과 재수 주의가 붙는다", () => {
    const csat = buildStops(seoul(2008), rules).find((s) => s.key === "csat")!;
    expect(csat.rules.map((r) => r.id)).toEqual(["csat-selective-2022-2027", "retake-risk-2008"]);
  });

  it("역은 시간순이고 현재 위치는 아직 오지 않은 첫 역 앞이다", () => {
    const stops = buildStops(gg(2012), rules);
    const idx = stops.map((s) => s.year * 12 + s.month);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(stops[herePosition(stops, { year: 2026, month: 11 })].key).toBe("high-apply");
  });
});

describe("generationTags / formatRemaining", () => {
  it("세대 키워드", () => {
    expect(generationTags(seoul(2008), rules)).toContain("마지막 선택형 수능 세대");
    expect(generationTags(seoul(2012), rules)).toEqual(
      expect.arrayContaining(["통합형 수능", "내신 5등급", "중학교부터 2022 개정 교육과정"]),
    );
  });
  it("남은 기간 표기", () => {
    expect(formatRemaining({ year: 2026, month: 11 }, { year: 2030, month: 11 })).toBe("4년");
    expect(formatRemaining({ year: 2026, month: 11 }, { year: 2027, month: 11 })).toBe("1년");
    expect(formatRemaining({ year: 2026, month: 11 }, { year: 2027, month: 2 })).toBe("3개월");
    expect(formatRemaining({ year: 2026, month: 11 }, { year: 2025, month: 2 })).toBe("지났어요");
  });
});


describe("news helpers", () => {
  it("학년에 따라 가까운 단계", () => {
    expect(nearStages(2012, { year: 2026, month: 11 })).toEqual(["middle", "high"]);
    expect(nearStages(2009, { year: 2026, month: 11 })).toEqual(["high", "university"]);
  });
  it("상대 시간", () => {
    const now = new Date("2026-11-02T12:00:00+09:00").getTime();
    expect(relativeDay("2026-11-02T09:00+09:00", now)).toBe("3시간 전");
    expect(relativeDay("2026-10-31T09:00+09:00", now)).toBe("2일 전");
    expect(relativeDay("2026-10-20T09:00+09:00", now)).toBe("10.20");
  });
});
