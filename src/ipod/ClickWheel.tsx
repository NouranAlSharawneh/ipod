import { useRef } from "react";
import { useWheel } from "../hooks/useWheel";

type Props = {
  onScroll: (delta: number) => void;
  onSelect: () => void;
  onMenu: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
};

export function ClickWheel(props: Props) {
  const ringRef = useRef<HTMLDivElement>(null);
  useWheel(ringRef, { onScroll: props.onScroll });

  return (
    <div className="relative" style={{ width: 280, height: 280 }}>
      <div
        ref={ringRef}
        className="ipod-wheel absolute inset-0 rounded-full touch-none"
        style={{ touchAction: "none" }}
      />
      <button
        onClick={props.onMenu}
        className="wheel-label absolute left-1/2 -translate-x-1/2 top-3 text-xs tracking-widest"
      >
        MENU
      </button>
      <button
        onClick={props.onPrev}
        className="wheel-label absolute left-3 top-1/2 -translate-y-1/2 text-base"
        aria-label="Previous"
      >
        ⏮
      </button>
      <button
        onClick={props.onNext}
        className="wheel-label absolute right-3 top-1/2 -translate-y-1/2 text-base"
        aria-label="Next"
      >
        ⏭
      </button>
      <button
        onClick={props.onPlayPause}
        className="wheel-label absolute left-1/2 -translate-x-1/2 bottom-3 text-base"
        aria-label="Play/Pause"
      >
        ⏯
      </button>
      <button
        onClick={props.onSelect}
        className="ipod-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 96, height: 96 }}
        aria-label="Select"
      />
    </div>
  );
}
