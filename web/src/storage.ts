/** localStorage 래퍼: 저장이 막힌 환경(사생활 보호 모드 등)에서도 앱이 동작하도록 실패를 삼킨다. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 무시 */
  }
}

export const KEYS = {
  profile: "showmethego3.profile",
  answers: "showmethego3.answers",
  checks: "showmethego3.checks",
  compare: "showmethego3.compare",
  lastVisit: "showmethego3.lastVisit",
  schoolArea: "showmethego3.schoolArea",
} as const;
