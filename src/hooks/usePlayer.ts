import { useEffect, useState } from "react";
import { api, type PlayerState } from "../state/api";

export function usePlayer(intervalMs = 1000): PlayerState | null {
  const [player, setPlayer] = useState<PlayerState | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.state();
        if (alive) setPlayer(s);
      } catch {
        /* bridge offline */
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return player;
}
