import guideJson from "../../data/guide.json";
import type { Status } from "./data";

export interface ReformCard {
  id: string;
  title: string;
  oneLine: string;
  fromBirthYear: number;
  fromLabel: string;
  big: { before: string; after: string };
  visual: "csat" | "credits" | "grades";
  points: { label: string; text: string }[];
  tip: string;
  status: Status;
  sources: string[];
}

export interface Term {
  term: string;
  aka?: string;
  group: string;
  text: string;
  status: Status;
  sources: string[];
}

export interface Faq {
  id: string;
  q: string;
  a: string;
  points: string[];
  tip?: string;
  link?: "fork" | "stats" | "school" | "route" | "news";
  fromBirthYear?: number;
  toBirthYear?: number;
  status: Status;
  sources: string[];
}

export interface Guide {
  lastReviewed: string;
  reforms: ReformCard[];
  termGroups: string[];
  terms: Term[];
  faq: Faq[];
}

export const guide = guideJson as Guide;

/** 5등급제 비율(교육부 2028 대입개편 확정안). 합은 100. */
export const FIVE_GRADE_SHARES = [10, 24, 32, 24, 10] as const;

export const reformApplies = (c: ReformCard, birthYear: number) => birthYear >= c.fromBirthYear;

export const faqIsMine = (f: Faq, birthYear: number) =>
  (f.fromBirthYear !== undefined || f.toBirthYear !== undefined) &&
  birthYear >= (f.fromBirthYear ?? -Infinity) &&
  birthYear <= (f.toBirthYear ?? Infinity);

/** 우리 아이에게 해당하는 질문을 먼저, 나머지는 원래 순서대로. */
export function sortFaq(list: Faq[], birthYear: number): Faq[] {
  return [...list].sort((a, b) => Number(faqIsMine(b, birthYear)) - Number(faqIsMine(a, birthYear)));
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 용어·별칭·설명에서 찾는다. 용어 이름이 맞는 항목을 먼저 보여준다. */
export function searchTerms(terms: Term[], query: string, group: string | null): Term[] {
  const q = norm(query);
  const inGroup = terms.filter((t) => group === null || t.group === group);
  if (!q) return inGroup;
  const head = (t: Term) => norm(t.term).includes(q) || norm(t.aka ?? "").includes(q);
  return [...inGroup.filter(head), ...inGroup.filter((t) => !head(t) && norm(t.text).includes(q))];
}
