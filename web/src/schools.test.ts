import { describe, expect, it } from "vitest";
import { areasFor, defaultLevel, netMove, shortName, sortSchools, type School } from "./schools";

const s = (o: Partial<School>): School => ({
  code: o.name ?? "x", name: "x", level: "middle", region: "gyeonggi", area: "용인시 수지구", kind: null, found: "공립",
  coed: "남녀공학", addr: null, lat: null, lng: null, url: null, students: null, byGrade: [null, null, null], classes: null,
  perClass: null, teachers: null, perTeacher: null, moveIn: null, moveOut: null, clubs: null, ...o,
});

describe("schools", () => {
  it("경기 학군은 해당 시·군·구를 앞에", () => {
    const all = ["과천시", "군포시", "수원시 장안구", "안양시 동안구", "의왕시", "평택시"];
    const r = areasFor({ birthYear: 2012, birthMonth: 5, region: "gyeonggi", district: "안양권" }, all);
    expect(r.mine).toEqual(["과천시", "군포시", "안양시 동안구", "의왕시"]);
    expect(r.others).toEqual(["수원시 장안구", "평택시"]);
  });
  it("서울은 학군 없이 전체", () => {
    const r = areasFor({ birthYear: 2012, birthMonth: 5, region: "seoul", district: null }, ["강남구", "노원구"]);
    expect(r.mine).toEqual([]);
  });
  it("정렬: 값 없는 학교는 뒤로", () => {
    const list = [s({ name: "가", perClass: 30 }), s({ name: "나", perClass: null }), s({ name: "다", perClass: 25 })];
    expect(sortSchools(list, "perClass").map((x) => x.name)).toEqual(["다", "가", "나"]);
    expect(sortSchools([s({ name: "가", students: 100 }), s({ name: "나", students: 900 })], "students")[0].name).toBe("나");
  });
  it("전입-전출 100명당", () => {
    expect(netMove(s({ students: 1000, moveIn: 47, moveOut: 28 }))).toBe(1.9);
    expect(netMove(s({ students: 0, moveIn: 1, moveOut: 0 }))).toBeNull();
  });
  it("학교급 기본값과 짧은 이름", () => {
    const p = (y: number) => ({ birthYear: y, birthMonth: 5, region: "seoul" as const, district: null });
    expect(defaultLevel(p(2014), { year: 2026, month: 11 })).toBe("middle"); // 초6
    expect(defaultLevel(p(2012), { year: 2026, month: 11 })).toBe("high"); // 중2
    expect(shortName("숙명여자중학교")).toBe("숙명여중");
  });
});
