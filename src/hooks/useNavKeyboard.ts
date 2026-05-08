import { useEffect } from "react";

export type Bindings = {
  onScroll: (delta: number) => void;
  onSelect: () => void;
  onMenu: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
};

export function useNavKeyboard(b: Bindings) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          b.onScroll(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          b.onScroll(-1);
          break;
        case "Enter":
          e.preventDefault();
          b.onSelect();
          break;
        case "Escape":
        case "Backspace":
          e.preventDefault();
          b.onMenu();
          break;
        case " ":
          e.preventDefault();
          b.onPlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          b.onNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          b.onPrev();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [b]);
}
