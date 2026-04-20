import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHomeLabs } from "../hooks/useHomeLabs.ts";
import { useAlertStream } from "../hooks/useAlertStream.ts";

const AUTO_DISMISS_MS = 10_000;

const METRIC_LABEL: Record<string, string> = {
  cpu: "CPU",
  memory: "Memory",
  disk: "Disk",
};

export function AlertBanner() {
  const { token } = useAuth();
  const { data: labs = [] } = useHomeLabs(token);
  const labIds = labs.map((l) => l.id);
  const labNameById = new Map(labs.map((l) => [l.id, l.name]));

  const { toasts, dismiss } = useAlertStream(labIds);

  // Auto-dismiss each toast after AUTO_DISMISS_MS.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismiss(t.alert.id), AUTO_DISMISS_MS - (Date.now() - t.firedLocalAt))
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(({ alert }) => {
        const labName = labNameById.get(alert.labId) ?? "Resource";
        return (
          <div
            key={alert.id}
            role="alert"
            className="flex items-start gap-3 bg-[#1a0a0a] border border-red-900 rounded-lg px-4 py-3 shadow-lg shadow-red-950/50"
          >
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <Link
                to={`/labs/${alert.labId}`}
                className="text-sm font-medium text-gray-100 hover:text-white truncate block"
              >
                {labName}
              </Link>
              <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                {METRIC_LABEL[alert.metric] ?? alert.metric} alert ·{" "}
                {alert.peakValue.toFixed(1)}% (threshold {alert.threshold.toFixed(0)}%)
              </p>
            </div>
            <button
              onClick={() => dismiss(alert.id)}
              className="p-1 -m-1 text-gray-500 hover:text-gray-300 shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
