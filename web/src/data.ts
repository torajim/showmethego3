import newsJson from "../../data/news.json";
import metaJson from "../../data/meta.json";
import sourcesJson from "../../data/sources.json";
import rulesJson from "../../data/rules.json";
import schoolTypesJson from "../../data/school_types.json";
import tracksJson from "../../data/university_tracks.json";

export type Status = "confirmed" | "needs_verification" | "planned";
export type Region = "seoul" | "gyeonggi";

export interface Source {
  id: string;
  title: string;
  publisher: string;
  date: string | null;
  url: string;
  official: boolean;
  accessed: string;
}

export interface Rule {
  id: string;
  stage: "all" | "middle" | "high" | "university";
  category: string;
  title: string;
  summary: string;
  appliesTo: { birthYearFrom: number; birthYearTo: number };
  regions: string[];
  status: Status;
  sources: string[];
  note?: string;
}

export interface SchoolType {
  id: string;
  name: string;
  round: string;
  selectedBy: string;
  scope: string;
  summary: string;
  fitFor: string[];
  watchOut: string[];
  status: Status;
  sources: string[];
  apply: { grade: string; months: string; note: string };
  checklist: string[];
}

export interface Track {
  id: string;
  name: string;
  season: string;
  mainFactor: string;
  summary: string;
  goodWhen: string[];
  status: Status;
  sources: string[];
}

export interface Meta {
  lastReviewed: string;
  coverage: { birthYearFrom: number; birthYearTo: number; regions: Region[] };
  regions: Record<string, string>;
  statusLabels: Record<Status, string>;
  disclaimer: string;
  changes: { date: string; text: string }[];
}

export const meta = metaJson as Meta;
export const sources = sourcesJson.sources as Source[];
export const rules = rulesJson.rules as Rule[];
export const schoolTypes = schoolTypesJson.highSchoolTypes as SchoolType[];
export const tracks = tracksJson.tracks as Track[];

export const sourceById = new Map(sources.map((s) => [s.id, s]));
export const ruleById = new Map(rules.map((r) => [r.id, r]));


export interface NewsItem {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publisherUrl: string;
  official: boolean;
  publishedAt: string;
  tags: string[];
  stages: string[];
  /** seoul / gyeonggi / other. 비어 있으면 전국 소식. */
  regions?: string[];
  /** 제목에 나온 서울·경기 지명 */
  places?: string[];
}

export const news = newsJson as { updatedAt: string; source: string; items: NewsItem[] };
