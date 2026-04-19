import { useEffect, useState } from "react";
import type { LabMetrics } from "@overwatch/shared-types";
import { getSocket } from "../lib/socket.ts";

export interface MetricsPoint {
  t: number;
  cpu: number;
  mem: number;
}

const MAX_HISTORY = 30;

interface LabMetricsState {
  metrics: LabMetrics | null;
  connected: boolean;
  lastUpdated: Date | null;
  history: MetricsPoint[];
}

export function useLabMetrics(labId: string | undefined): LabMetricsState {
  const [metrics, setMetrics] = useState<LabMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [history, setHistory] = useState<MetricsPoint[]>([]);

  useEffect(() => {
    if (!labId) return;

    const socket = getSocket();

    function onConnect() {
      setConnected(true);
      socket.emit("dashboard:subscribe", { labId });
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onMetrics(payload: LabMetrics) {
      if (payload.labId !== labId) return;
      setMetrics(payload);
      setLastUpdated(new Date());
      const memPct =
        payload.memory.totalBytes > 0
          ? Math.round((payload.memory.usedBytes / payload.memory.totalBytes) * 100)
          : 0;
      setHistory((prev) => [
        ...prev.slice(-(MAX_HISTORY - 1)),
        { t: Date.now(), cpu: Math.round(payload.cpu.usagePercent), mem: memPct },
      ]);
    }

    if (socket.connected) {
      setConnected(true);
      socket.emit("dashboard:subscribe", { labId });
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("lab:metrics", onMetrics);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("lab:metrics", onMetrics);
    };
  }, [labId]);

  return { metrics, connected, lastUpdated, history };
}
