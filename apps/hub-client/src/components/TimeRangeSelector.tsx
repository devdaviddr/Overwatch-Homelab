import { Clock } from "lucide-react";

export type TimeRange = "1h" | "6h" | "24h" | "7d";

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
];

interface Props {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono uppercase tracking-wide">
        <Clock className="h-3.5 w-3.5" />
        Range
      </div>
      <div className="flex items-center gap-1">
        {RANGES.map((r) => {
          const active = r.value === value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange(r.value)}
              aria-pressed={active}
              className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors ${
                active
                  ? "bg-brand-500/10 text-brand-300 border-brand-400"
                  : "bg-gray-900 text-gray-500 border-gray-800 hover:text-gray-300 hover:border-gray-700"
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
