import { useEffect, useRef } from "react";

type Opts = {
  onScroll: (delta: number) => void;
  threshold?: number; // degrees per tick
};

export function useWheel(
  ref: React.RefObject<HTMLDivElement | null>,
  { onScroll, threshold = 18 }: Opts,
) {
  const stateRef = useRef({ active: false, lastAngle: 0, accum: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const angleAt = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    };

    const onDown = (e: PointerEvent) => {
      stateRef.current = { active: true, lastAngle: angleAt(e), accum: 0 };
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s.active) return;
      const a = angleAt(e);
      let d = a - s.lastAngle;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      s.accum += d;
      s.lastAngle = a;
      while (s.accum >= threshold) {
        onScroll(1);
        s.accum -= threshold;
      }
      while (s.accum <= -threshold) {
        onScroll(-1);
        s.accum += threshold;
      }
    };
    const onUp = (e: PointerEvent) => {
      stateRef.current.active = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* empty */
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [ref, onScroll, threshold]);
}
