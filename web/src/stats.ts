import statsJson from "../../data/stats.json";
import type { Status } from "./data";

export interface StatPoint {
  year: number;
  value: number;
  status: Status;
  sources: string[];
  note?: string;
}

export interface CompetitionSeries {
  id: string;
  name: string;
  scope: string;
  apply: string;
  points: StatPoint[];
}

export interface Takeaway {
  text: string;
  sources: string[];
}

export interface SusiPoint {
  year: number;
  susi: number;
  status: Status;
  sources: string[];
}

export interface ReformRow {
  label: string;
  before: string;
  after: string;
  impact: string;
  sources: string[];
}

export interface StatsDoc {
  lastReviewed: string;
  hsCompetition: {
    title: string;
    unit: string;
    basis: string;
    series: CompetitionSeries[];
    takeaways: Takeaway[];
    pending: string;
  };
  susiJeongsi: { title: string; basis: string; points: SusiPoint[]; takeaways: Takeaway[]; nextRelease: string };
  reform2028: {
    title: string;
    before: string;
    after: string;
    beforeCohort: string;
    afterCohort: string;
    rows: ReformRow[];
  };
}

export const stats = statsJson as StatsDoc;

/** 고1로 입학하는 해(= 고입 학년도). 원서는 그 전해 중3 때 낸다. */
export const hsAdmissionYear = (birthYear: number) => birthYear + 16;
/** 대학에 입학하는 해(= 대입 학년도). */
export const univAdmissionYear = (birthYear: number) => birthYear + 19;

/** 2028 개편 적용 여부: 2009년생(2028학년도 입학)부터. */
export const isAfterReform = (birthYear: number) => univAdmissionYear(birthYear) >= 2028;

/** 마지막 값과 바로 앞 해 값의 차이. 앞 해가 없으면 null. */
export function lastChange(points: StatPoint[]): { last: StatPoint; delta: number | null } | null {
  if (!points.length) return null;
  const last = points[points.length - 1];
  const prev = points.find((p) => p.year === last.year - 1);
  return { last, delta: prev ? Math.round((last.value - prev.value) * 100) / 100 : null };
}

/** 축 눈금: 0부터 max를 넘는 첫 '좋은' 값까지 4~5칸. */
export function niceTicks(max: number): number[] {
  const steps = [0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50];
  const step = steps.find((s) => max / s <= 4) ?? 100;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** 아이 대입 학년도의 수시 비율. 아직 발표 전이면 가장 최근 발표값과 함께 future=true. */
export function susiFor(birthYear: number, points: SusiPoint[]): { point: SusiPoint; future: boolean } | null {
  if (!points.length) return null;
  const y = univAdmissionYear(birthYear);
  const hit = points.find((p) => p.year === y);
  if (hit) return { point: hit, future: false };
  const latest = points[points.length - 1];
  return y > latest.year ? { point: latest, future: true } : null;
}

export const fmtRatio = (v: number) => v.toFixed(2);
