import { useEffect, useState } from "react";
import { api } from "../state/api";

export type Battery = { percent: number; charging: boolean } | null;

export function useBattery(intervalMs = 30_000): Battery {
  const [battery, setBattery] = useState<Battery>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const b = await api.battery();
        if (alive) setBattery(b);
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

  return battery;
}
