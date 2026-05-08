import type { Battery } from "../hooks/useBattery";

export function BatteryIcon({ battery }: { battery: Battery }) {
  const pct = Math.max(0, Math.min(100, battery?.percent ?? 100));
  const fillColor =
    pct <= 15 ? "#cc3333" : pct <= 30 ? "#d6a000" : "#1a1a1a";

  return (
    <span
      title={battery ? `${pct}%${battery.charging ? " (charging)" : ""}` : ""}
      className="inline-flex items-center"
    >
      <svg width="20" height="10" viewBox="0 0 20 10" aria-hidden>
        <rect
          x="0.5"
          y="0.5"
          width="17"
          height="9"
          rx="1"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="1"
        />
        <rect x="17.5" y="3" width="2" height="4" rx="0.5" fill="#1a1a1a" />
        <rect
          x="2"
          y="2"
          width={Math.max(0, (pct / 100) * 14)}
          height="6"
          fill={fillColor}
        />
        {battery?.charging && (
          <path
            d="M9 2 L7 6 L9.5 6 L8 9 L11 5 L9 5 Z"
            fill="#f5d000"
            stroke="#1a1a1a"
            strokeWidth="0.3"
          />
        )}
      </svg>
    </span>
  );
}
