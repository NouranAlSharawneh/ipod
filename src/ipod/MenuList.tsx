import { useEffect, useRef } from "react";

export type MenuItem = {
  key: string;
  label: string;
  trailing?: string;
  hasChildren?: boolean;
  leadingImage?: string;
};

type Props = {
  items: MenuItem[];
  selected: number;
  loaded?: boolean;
  onActivate?: (i: number) => void;
};

const ROW_HEIGHT = 26;
const THUMB_SIZE = 20;

export function MenuList({ items, selected, loaded, onActivate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rowTop = selected * ROW_HEIGHT;
    const visTop = el.scrollTop;
    const visBot = visTop + el.clientHeight;
    if (rowTop < visTop) el.scrollTop = rowTop;
    else if (rowTop + ROW_HEIGHT > visBot)
      el.scrollTop = rowTop + ROW_HEIGHT - el.clientHeight;
  }, [selected]);

  if (!items.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-gray-500">
        {loaded === false ? (
          <>
            <span className="ipod-spinner" aria-hidden />
            <span>Loading…</span>
          </>
        ) : (
          <span>Empty</span>
        )}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-hidden">
      {items.map((item, i) => {
        const isSel = i === selected;
        return (
          <div
            key={item.key}
            onClick={() => onActivate?.(i)}
            className={`flex items-center gap-2 px-2 text-[13px] leading-none ${isSel ? "ipod-row-selected" : "text-black"}`}
            style={{ height: ROW_HEIGHT }}
          >
            {item.leadingImage && (
              <img
                src={item.leadingImage}
                alt=""
                loading="lazy"
                decoding="async"
                className="rounded-sm shrink-0 object-cover bg-black/10"
                style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility =
                    "hidden";
                }}
              />
            )}
            <span className="flex-1 truncate">{item.label}</span>
            {item.trailing && (
              <span className="opacity-70 mr-1 text-[11px]">
                {item.trailing}
              </span>
            )}
            {item.hasChildren && <span className="text-xs">›</span>}
          </div>
        );
      })}
    </div>
  );
}
