import type { Region, Rule } from "./data";

/** 경기도 평준화 학군(2027학년도 경기도교육청 배정 방안 기준). */
export const GG_EQUALIZED = ["수원", "성남", "안양권", "부천", "고양", "광명", "안산", "의정부", "용인"] as const;
export const GG_OTHER = "그 외 지역";

export interface Profile {
  birthYear: number;
  birthMonth: number;
  region: Region;
  /** 경기일 때 고교 학군. 서울이면 null. */
  district: string | null;
}

export interface YearMonth {
  year: number;
  month: number; // 1~12
}

/** 2009학년도부터 1~12월 출생자가 같은 해 3월에 함께 초등학교에 입학한다. */
export const ELEMENTARY_ENTRY_OFFSET = 7;

export const monthIndex = ({ year, month }: YearMonth) => year * 12 + (month - 1);

export function gradeAt(birthYear: number, at: YearMonth): string {
  const schoolYear = at.month >= 3 ? at.year : at.year - 1;
  const n = schoolYear - (birthYear + ELEMENTARY_ENTRY_OFFSET) + 1;
  if (n <= 0) return "미취학";
  if (n <= 6) return `초${n}`;
  if (n <= 9) return `중${n - 6}`;
  if (n <= 12) return `고${n - 9}`;
  return "졸업";
}

export const admissionYear = (birthYear: number) => birthYear + ELEMENTARY_ENTRY_OFFSET + 12;

export function applies(rule: Rule, p: Pick<Profile, "birthYear" | "region">): boolean {
  const { birthYearFrom, birthYearTo } = rule.appliesTo;
  return (
    birthYearFrom <= p.birthYear &&
    p.birthYear <= birthYearTo &&
    (rule.regions.includes("KR") || rule.regions.includes(p.region))
  );
}

export const isEqualized = (p: Profile) =>
  p.region === "seoul" || (p.district !== null && (GG_EQUALIZED as readonly string[]).includes(p.district));

export function regionLabel(p: Profile): string {
  return p.region === "seoul" ? "서울" : `경기 ${p.district ?? ""}`.trim();
}

export interface Stop extends YearMonth {
  key: string;
  title: string;
  text: string;
  rules: Rule[];
  big?: boolean;
  fork?: boolean;
  alert?: string;
}

/** 출생연도·지역에 맞는 노선도 역 목록(시간순). */
export function buildStops(p: Profile, allRules: Rule[]): Stop[] {
  const byId = new Map(allRules.map((r) => [r.id, r]));
  const R = (id: string): Rule | null => {
    const r = byId.get(id);
    return r && applies(r, p) ? r : null;
  };
  const Y = p.birthYear;
  const out: Stop[] = [];
  const push = (s: Omit<Stop, "rules"> & { rules: (Rule | null)[] }) =>
    out.push({ ...s, rules: s.rules.filter((r): r is Rule => r !== null) });

  const medical = R("regional-talent-medical");
  push({
    key: "middle-entry",
    year: Y + 13,
    month: 3,
    title: "중학교 입학",
    text: "시험 없이 사는 곳의 학교군·중학구 안에서 추첨으로 배정돼요.",
    rules: [R("middle-school-assignment"), R("curriculum-2022-middle"), medical],
    alert: medical ? "지방 의약학 지역인재를 노린다면 이사는 중학교 입학 전에" : undefined,
  });

  const gg12 = R("gyeonggi-middle-grade-1-2");
  if (gg12) {
    push({
      key: "middle-grade-start",
      year: Y + 13,
      month: 8,
      title: "중1 2학기, 고입 내신이 시작돼요",
      text: "경기는 중학교 1학년 2학기 성적부터 고입에 반영돼요.",
      rules: [gg12],
    });
  }

  const equalized = isEqualized(p);
  push({
    key: "high-apply",
    year: Y + 15,
    month: 11,
    title: "고등학교 원서",
    big: true,
    fork: true,
    text:
      p.region === "seoul"
        ? "전기(과고·특성화고) → 후기(외고·국제고·자사고·일반고) 순서로 지원해요. 일반고는 성취도 성적으로 선발한 뒤 단계별로 추첨해요."
        : equalized
          ? `${p.district} 학군은 평준화 지역이에요. 중학교 내신 200점으로 선발한 뒤 지망에 따라 추첨 배정돼요.`
          : "비평준화 지역은 학교마다 내신으로 선발해요. 중학교 내신이 곧 고입 전략이에요.",
    rules: [
      R("seoul-hs-absolute-grade"),
      R("seoul-hs-lottery-stages"),
      p.region === "gyeonggi" ? (equalized ? R("gyeonggi-equalized-hs") : R("gyeonggi-non-equalized")) : null,
      R("special-hs-retained"),
    ],
  });

  const fiveLevels = R("hs-grade-5-levels");
  push({
    key: "high-entry",
    year: Y + 16,
    month: 3,
    title: "고1 입학",
    text: fiveLevels
      ? "내신 5등급제와 고교학점제로 3년을 보내요. 1등급은 상위 10%예요."
      : "내신 9등급제(1등급 상위 4%)로 3년을 보내요.",
    rules: [fiveLevels, R("hs-grade-9-levels"), R("credit-system"), R("credit-system-relief-2026")],
  });

  push({
    key: "high-2",
    year: Y + 17,
    month: 3,
    title: "고2, 선택과목이 진로를 말해요",
    text: "어떤 과목을 골라 어떻게 공부했는지가 학생부종합전형의 근거가 돼요.",
    rules: [R("credit-system")],
  });

  push({
    key: "susi",
    year: Y + 18,
    month: 9,
    title: "수시 원서 6장",
    text: "학생부교과·학생부종합·논술 전형에 최대 6곳까지 지원해요.",
    rules: [R("regional-doctor-2028"), R("medical-quota-2027")],
  });

  const integrated = R("csat-integrated-2028");
  push({
    key: "csat",
    year: Y + 18,
    month: 11,
    title: `${admissionYear(Y)}학년도 수능`,
    big: true,
    text: integrated ? "선택과목 없는 통합형 수능을 치러요." : "마지막 선택형 수능이에요. 재수하면 시험 체제가 바뀌어요.",
    rules: [integrated, R("csat-selective-2022-2027"), R("retake-risk-2008")],
  });

  push({ key: "university", year: Y + 19, month: 3, title: "대학 입학", text: "수고 많으셨어요.", rules: [] });

  return out.sort((a, b) => monthIndex(a) - monthIndex(b));
}

/** 현재 위치 핀이 들어갈 자리: 아직 지나지 않은 첫 역의 인덱스(모두 지났으면 length). */
export function herePosition(stops: Stop[], now: YearMonth): number {
  const i = stops.findIndex((s) => monthIndex(s) >= monthIndex(now));
  return i === -1 ? stops.length : i;
}

export function generationTags(p: Profile, allRules: Rule[]): string[] {
  const has = (id: string) => allRules.some((r) => r.id === id && applies(r, p));
  const t: string[] = [];
  if (has("csat-selective-2022-2027")) t.push("마지막 선택형 수능 세대");
  if (has("csat-integrated-2028")) t.push("통합형 수능");
  if (has("hs-grade-5-levels")) t.push("내신 5등급");
  if (has("hs-grade-9-levels")) t.push("내신 9등급");
  if (has("credit-system")) t.push("고교학점제");
  if (has("curriculum-2022-middle")) t.push("중학교부터 2022 개정 교육과정");
  return t;
}

/** 남은 기간을 "1년 3개월", "4년", "5개월", "지났어요"로. */
export function formatRemaining(from: YearMonth, to: YearMonth): string {
  const n = monthIndex(to) - monthIndex(from);
  if (n <= 0) return "지났어요";
  if (n < 12) return `${n}개월`;
  const y = Math.floor(n / 12);
  const m = n % 12;
  return m ? `${y}년 ${m}개월` : `${y}년`;
}

/** 대입에서 유리한 쪽의 일반적 경향(0=내신·수시, 100=수능·정시). 정성적 위치이며 학교마다 다르다. */
export const FORK_TENDENCY: Record<string, number> = {
  vocational: 15,
  general: 25,
  "foreign-language-international": 62,
  science: 70,
  "autonomous-private": 75,
  gifted: 80,
};

/** 지금 학년에서 가까운 미래에 신경 쓸 단계(뉴스 필터용). */
export function nearStages(birthYear: number, now: YearMonth): Array<"middle" | "high" | "university"> {
  const g = gradeAt(birthYear, now);
  if (g.startsWith("고") || g === "졸업") return ["high", "university"];
  return ["middle", "high"];
}

export function relativeDay(iso: string, nowMs: number): string {
  const diff = Math.floor((nowMs - new Date(iso).getTime()) / 3_600_000);
  if (diff < 1) return "방금";
  if (diff < 24) return `${diff}시간 전`;
  const d = Math.floor(diff / 24);
  return d < 7 ? `${d}일 전` : iso.slice(5, 10).replace("-", ".");
}

/** "중2" → "예요", "고3" → "이에요": 학년 이름 뒤에 붙는 서술격 조사. */
export function copula(grade: string): string {
  const last = grade.slice(-1);
  // 숫자는 읽는 소리 기준: 2(이)·4(사)·5(오)는 받침 없음
  if ("245".includes(last) && /\d/.test(last)) return "예요";
  if (/\d/.test(last)) return "이에요";
  const code = last.charCodeAt(0) - 0xac00;
  return code >= 0 && code < 11172 && code % 28 === 0 ? "예요" : "이에요";
}
