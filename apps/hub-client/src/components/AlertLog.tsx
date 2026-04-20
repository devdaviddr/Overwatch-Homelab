import { useState } from "react";
import { AlertTriangle, Check, Loader2, BellOff } from "lucide-react";
import { useAlerts, useAcknowledgeAlert } from "../hooks/useAlerts.ts";
import type { Alert } from "@overwatch/shared-types";

interface Props {
  token: string | null;
  labId: string;
}

const METRIC_LABEL: Record<Alert["metric"], string> = {
  cpu: "CPU",
  memory: "Memory",
  disk: "Disk",
};

function StatusPill({ alert }: { alert: Alert }) {
  if (alert.resolvedAt) {
    return (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-gray-900 border-gray-800 text-gray-500">
        RESOLVED
      </span>
    );
  }
  if (alert.acknowledgedAt) {
    return (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-amber-950/30 border-amber-900/60 text-amber-400">
        ACKNOWLEDGED
      </span>
    );
  }
  return (
    <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-red-950/30 border-red-900/60 text-red-400">
      ACTIVE
    </span>
  );
}

export function AlertLog({ token, labId }: Props) {
  const [filter, setFilter] = useState<"active" | "resolved" | "all">("all");
  const { data: alerts = [], isLoading, error } = useAlerts(token, labId, filter);
  const acknowledge = useAcknowledgeAlert(token);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-mono tracking-[0.18em] uppercase text-gray-500">Alert log</h3>
        <div className="flex items-center gap-1">
          {(["active", "resolved", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={f === filter}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-md border transition-colors ${
                f === filter
                  ? "bg-brand-500/10 text-brand-300 border-brand-400"
                  : "bg-gray-900 text-gray-500 border-gray-800 hover:text-gray-300 hover:border-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-10 text-center">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500 mx-auto" />
        </div>
      ) : error ? (
        <div className="bg-[#060d1a] border border-red-900/60 rounded-xl p-6 text-sm text-red-400 font-mono">
          Failed to load alerts: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-10 text-center">
          <BellOff className="h-5 w-5 text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-gray-600 font-mono">No alerts in this view.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => {
            const active = !a.resolvedAt;
            const unack = active && !a.acknowledgedAt;
            return (
              <div
                key={a.id}
                className="bg-[#060d1a] border border-gray-800/60 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <AlertTriangle className={`h-4 w-4 shrink-0 ${active ? "text-red-400" : "text-gray-600"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-sans font-medium text-gray-100">{METRIC_LABEL[a.metric]}</span>
                    <StatusPill alert={a} />
                    <span className="text-[11px] font-mono text-gray-500">
                      peak {a.peakValue.toFixed(1)}% / threshold {a.threshold.toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-gray-600 mt-0.5">
                    fired {new Date(a.firedAt).toLocaleString()}
                    {a.resolvedAt && <> · resolved {new Date(a.resolvedAt).toLocaleString()}</>}
                  </p>
                </div>
                {unack && (
                  <button
                    onClick={() => acknowledge.mutate({ labId, alertId: a.id })}
                    disabled={acknowledge.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-700/60 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Acknowledge
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
