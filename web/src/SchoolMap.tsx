import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { shortName, withCoords, type School } from "./schools";

/** 학교 유형 → 범례 색(항목에 고정). 중학교는 한 가지 색. */
export const KIND_SLOT: Record<string, number> = { 일반고: 1, 자율고: 2, 특목고: 3, 특성화고: 4 };
const slotOf = (s: School) => (s.level === "middle" ? 1 : KIND_SLOT[s.kind ?? ""] ?? 5);

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#3182F6";
}

const fmt = (v: number | null) => (v === null ? "–" : v.toLocaleString("ko-KR"));

/** OpenStreetMap 타일 위에 학교를 학생 수 크기의 점으로 찍는다. 점을 누르면 아래 카드로 요약을 보여준다. */
export default function SchoolMap({ list, onOpen }: { list: School[]; onOpen: (s: School) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [sel, setSel] = useState<School | null>(null);
  const points = withCoords(list);
  const missing = list.length - points.length;

  useEffect(() => {
    if (!box.current || map.current) return;
    map.current = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    setSel(null);
    if (!points.length) {
      m.setView([37.5, 127.0], 10);
      return;
    }
    const maxStudents = Math.max(1, ...points.map((s) => s.students ?? 0));
    const colors = [1, 2, 3, 4, 5].map((i) => cssVar(`--s${i}`));
    const ring = cssVar("--surface");
    for (const s of points) {
      const r = 6 + Math.sqrt((s.students ?? 0) / maxStudents) * 9;
      L.circleMarker([s.lat, s.lng], {
        radius: r,
        color: ring,
        weight: 2,
        fillColor: colors[slotOf(s) - 1],
        fillOpacity: 0.85,
      })
        .bindTooltip(shortName(s.name), { direction: "top", offset: [0, -r] })
        .on("click", () => setSel(s))
        .addTo(g);
    }
    m.fitBounds(L.latLngBounds(points.map((s) => [s.lat, s.lng] as [number, number])), { padding: [24, 24], maxZoom: 15 });
    // 데이터가 바뀐 경우에만 다시 그린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((s) => s.code).join(",")]);

  return (
    <div className="map-wrap">
      <div ref={box} className="school-map" role="region" aria-label="학교 위치 지도" />
      <div className="legend map-legend">
        {list.some((s) => s.level === "high") ? (
          Object.entries(KIND_SLOT).map(([k, i]) => (
            <span key={k}>
              <i className={`sw dot s${i}`} />
              {k}
            </span>
          ))
        ) : (
          <span>
            <i className="sw dot s1" />
            중학교
          </span>
        )}
        <span>점이 클수록 학생이 많아요</span>
      </div>
      {sel ? (
        <button className="map-card" onClick={() => onOpen(sel)}>
          <span>
            <b>{sel.name}</b>
            <small className="num">
              학생 {fmt(sel.students)}명 · 학급당 {fmt(sel.perClass)}명 · 교원 1인당 {fmt(sel.perTeacher)}명
            </small>
          </span>
          <span className="chev">자세히 ›</span>
        </button>
      ) : (
        <p className="eyebrow map-hint">점을 누르면 학교 요약을 볼 수 있어요.{missing > 0 && ` 위치 정보가 없는 ${missing}곳은 목록에서 확인하세요.`}</p>
      )}
    </div>
  );
}
