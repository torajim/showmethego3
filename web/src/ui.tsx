import type { ReactNode } from "react";
import { sourceById } from "./data";

export type SheetContent = { title: string; body: ReactNode };

export function Sources({ ids }: { ids: string[] }) {
  const list = ids.map((id) => sourceById.get(id)).filter((s) => !!s);
  if (!list.length) return null;
  return (
    <div className="src">
      {list.map((s) => (
        <span key={s!.id}>
          {s!.official && <span className="off">공식</span>}
          <a href={s!.url} target="_blank" rel="noopener noreferrer">
            {s!.publisher} · {s!.title}
          </a>
          {s!.date && <span className="num"> ({s!.date})</span>}
        </span>
      ))}
    </div>
  );
}

export function Sheet({ title, body, onClose }: SheetContent & { onClose: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-inner">
          <div className="grab" />
          <h2>{title}</h2>
          {body}
          <p className="eyebrow">참고용 정보예요. 최종 결정 전 공식 모집요강으로 꼭 확인하세요.</p>
          <button className="primary" autoFocus onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </>
  );
}

