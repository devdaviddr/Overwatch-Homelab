import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Alert } from "@overwatch/shared-types";
import { getSocket } from "../lib/socket.ts";

// Keeps a short in-memory queue of alerts fired during the current session.
// Dismissed entries never reappear even if the server re-emits. Consumed by
// the global AlertBanner.
export interface AlertToast {
  alert: Alert;
  firedLocalAt: number;
}

export function useAlertStream(labIds: string[]): {
  toasts: AlertToast[];
  dismiss: (id: string) => void;
} {
  const qc = useQueryClient();
  const [toasts, setToasts] = useState<AlertToast[]>([]);

  useEffect(() => {
    if (labIds.length === 0) return;
    const socket = getSocket();

    function onFired(a: Alert) {
      setToasts((prev) => {
        if (prev.some((t) => t.alert.id === a.id)) return prev;
        return [...prev, { alert: a, firedLocalAt: Date.now() }];
      });
      // Refresh alert lists + sidebar badge immediately.
      qc.invalidateQueries({ queryKey: ["alerts", a.labId] });
      qc.invalidateQueries({ queryKey: ["alerts", a.labId, "active", "count"] });
    }

    function onResolved(a: Alert) {
      qc.invalidateQueries({ queryKey: ["alerts", a.labId] });
      qc.invalidateQueries({ queryKey: ["alerts", a.labId, "active", "count"] });
    }

    function subscribeAll() {
      for (const labId of labIds) {
        socket.emit("dashboard:subscribe", { labId });
      }
    }

    if (socket.connected) subscribeAll();
    socket.on("connect", subscribeAll);
    socket.on("lab:alert", onFired);
    socket.on("lab:alert-resolved", onResolved);

    return () => {
      socket.off("connect", subscribeAll);
      socket.off("lab:alert", onFired);
      socket.off("lab:alert-resolved", onResolved);
    };
  }, [labIds.join("|"), qc]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.alert.id !== id));
  }

  return { toasts, dismiss };
}
