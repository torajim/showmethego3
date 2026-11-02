import { GG_OTHER, gradeAt, type Profile, type YearMonth } from "./engine";

export type Level = "middle" | "high";

export interface School {
  code: string;
  name: string;
  level: Level;
  region: "seoul" | "gyeonggi";
  area: string;
  kind: string | null;
  found: string | null;
  coed: string | null;
  addr: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  infoId?: string | null;
  students: number | null;
  byGrade: (number | null)[];
  classes: number | null;
  perClass: number | null;
  teachers: number | null;
  perTeacher: number | null;
  moveIn: number | null;
  moveOut: number | null;
  clubs: number | null;
}

export interface SchoolsDoc {
  fetchedAt: string | null;
  pbanYear: number | null;
  source: { title: string; publisher: string; url: string; license: string };
  schools: School[];
}

/** 학교 데이터는 크기가 커서 학교 탭을 열 때만 불러온다. */
export const loadSchools = (): Promise<SchoolsDoc> =>
  import("../../data/schools.json").then((m) => (m.default ?? m) as unknown as SchoolsDoc);

/** 경기 학군 이름 → 학교알리미 시·군·구 이름 앞부분 */
const GG_DISTRICT_AREAS: Record<string, string[]> = {
  수원: ["수원시"],
  성남: ["성남시"],
  안양권: ["안양시", "과천시", "군포시", "의왕시"],
  부천: ["부천시"],
  고양: ["고양시"],
  광명: ["광명시"],
  안산: ["안산시"],
  의정부: ["의정부시"],
  용인: ["용인시"],
};

/** 우리 아이 지역에 해당하는 시·군·구(앞쪽) + 나머지 지역(뒤쪽). */
export function areasFor(p: Profile, all: string[]): { mine: string[]; others: string[] } {
  if (p.region === "gyeonggi" && p.district && p.district !== GG_OTHER) {
    const prefixes = GG_DISTRICT_AREAS[p.district] ?? [p.district];
    const mine = all.filter((a) => prefixes.some((x) => a.startsWith(x)));
    return { mine, others: all.filter((a) => !mine.includes(a)) };
  }
  return { mine: [], others: all };
}

/** 아이 학년 기준으로 먼저 보여줄 학교급: 초등~중1은 중학교, 그 뒤는 고등학교. */
export function defaultLevel(p: Profile, now: YearMonth): Level {
  const g = gradeAt(p.birthYear, now);
  return g.startsWith("초") || g === "미취학" || g === "중1" ? "middle" : "high";
}

export type SortKey = "students" | "perClass" | "perTeacher" | "name";

export const SORTS: [SortKey, string][] = [
  ["students", "학생 많은 순"],
  ["perClass", "학급당 학생 적은 순"],
  ["perTeacher", "교원 1인당 학생 적은 순"],
  ["name", "이름순"],
];

export function sortSchools(list: School[], key: SortKey): School[] {
  const v = (s: School, k: Exclude<SortKey, "name">) => s[k] ?? null;
  return [...list].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name, "ko");
    const x = v(a, key);
    const y = v(b, key);
    if (x === null && y === null) return a.name.localeCompare(b.name, "ko");
    if (x === null) return 1;
    if (y === null) return -1;
    return key === "students" ? y - x : x - y;
  });
}

export const shortName = (name: string) =>
  name.replace(/고등학교$/, "고").replace(/중학교$/, "중").replace(/여자/, "여");

export function average(list: School[], k: "perClass" | "perTeacher" | "students"): number | null {
  const xs = list.map((s) => s[k]).filter((x): x is number => typeof x === "number");
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
}

/** 전입−전출. 학생 100명당으로 환산해 학교 크기 차이를 줄인다. */
export function netMove(s: School): number | null {
  if (s.moveIn === null || s.moveOut === null || !s.students) return null;
  return Math.round(((s.moveIn - s.moveOut) / s.students) * 1000) / 10;
}

export const schoolInfoUrl = (s: School) =>
  s.infoId
    ? `https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=${encodeURIComponent(s.infoId)}`
    : `https://www.schoolinfo.go.kr/ng/go/pnnggo_a01_l0.do`;

export const mapUrl = (s: School) => `https://map.naver.com/p/search/${encodeURIComponent(s.name + " " + s.area)}`;
