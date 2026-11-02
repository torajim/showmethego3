import { useEffect, useRef, type ReactNode } from "react";
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
  const ref = useRef<HTMLDivElement>(null);
  // 긴 시트가 아래 '확인' 버튼 쪽으로 스크롤되지 않도록, 시트 자체에 포커스를 두고 맨 위부터 보여준다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = 0;
    el.focus({ preventScroll: true });
  }, [title]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-inner">
          <div className="grab" />
          <h2>{title}</h2>
          {body}
          <p className="eyebrow">참고용 정보예요. 최종 결정 전 공식 모집요강으로 꼭 확인하세요.</p>
          <button className="primary" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </>
  );
}

