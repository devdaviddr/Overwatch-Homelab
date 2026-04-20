import { useState } from "react";
import { Bell, Save, Loader2, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useUpdateHomeLab } from "../hooks/useHomeLabMutations.ts";
import type { AlertThresholds } from "@overwatch/shared-types";

interface Props {
  lab: {
    id: string;
    retentionDays?: number;
    alertThresholds?: AlertThresholds | null;
  };
}

const DEFAULTS: AlertThresholds = {
  cpuPercent: 85,
  memPercent: 90,
  diskPercent: 80,
  consecutiveBreaches: 3,
};

export function AlertSettingsPanel({ lab }: Props) {
  const { token } = useAuth();
  const update = useUpdateHomeLab(token);

  const initialThresholds = lab.alertThresholds ?? DEFAULTS;
  const [enabled, setEnabled] = useState(!!lab.alertThresholds);
  const [cpu, setCpu] = useState(initialThresholds.cpuPercent);
  const [mem, setMem] = useState(initialThresholds.memPercent);
  const [disk, setDisk] = useState(initialThresholds.diskPercent);
  const [breaches, setBreaches] = useState(initialThresholds.consecutiveBreaches);
  const [retention, setRetention] = useState(lab.retentionDays ?? 30);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      await update.mutateAsync({
        id: lab.id,
        retentionDays: retention,
        alertThresholds: enabled
          ? {
              cpuPercent: clamp(cpu, 1, 100),
              memPercent: clamp(mem, 1, 100),
              diskPercent: clamp(disk, 1, 100),
              consecutiveBreaches: clamp(breaches, 1, 60),
            }
          : null,
      });
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-gray-500" />
        <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-gray-500">Alerts &amp; retention</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm text-gray-200 font-medium">Enable alerts</label>
          <p className="text-[11px] text-gray-600 font-mono mt-0.5">
            Fires when a metric exceeds its threshold for N consecutive readings.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            enabled ? "bg-brand-500" : "bg-gray-700"
          }`}
        >
          <span
            className={`absolute top-0.5 ${enabled ? "left-5" : "left-0.5"} h-4 w-4 rounded-full bg-white transition-all`}
          />
        </button>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${enabled ? "" : "opacity-50 pointer-events-none"}`}>
        <ThresholdField label="CPU %" value={cpu} onChange={setCpu} />
        <ThresholdField label="Memory %" value={mem} onChange={setMem} />
        <ThresholdField label="Disk %" value={disk} onChange={setDisk} />
        <ThresholdField
          label="Consecutive breaches"
          value={breaches}
          onChange={setBreaches}
          max={60}
          suffix="readings"
        />
      </div>

      <div className="pt-4 border-t border-gray-800/60">
        <ThresholdField
          label="Retention (days)"
          value={retention}
          onChange={setRetention}
          max={365}
          suffix="days"
        />
        <p className="text-[11px] text-gray-600 font-mono mt-2">
          Historical snapshots older than this are pruned every 6h. Default 30.
        </p>
      </div>

      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={status === "saving"}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-100 bg-brand-600 hover:bg-brand-500 border border-brand-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {status === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save settings
        </button>
        {status === "saved" && (
          <span className="text-xs text-green-400 font-mono flex items-center gap-1">
            <Check className="h-3.5 w-3.5" />
            saved
          </span>
        )}
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  if (isNaN(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function ThresholdField({
  label,
  value,
  onChange,
  max = 100,
  suffix = "%",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-mono text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 bg-gray-950 border border-gray-800 rounded-md px-3 py-1.5 text-sm text-gray-100 font-mono tabular-nums focus:outline-none focus:border-brand-500"
        />
        <span className="text-[11px] text-gray-600 font-mono">{suffix}</span>
      </div>
    </div>
  );
}
