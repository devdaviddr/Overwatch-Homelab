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

    function subscribe() {
      socket.emit("dashboard:subscribe", { labId });
    }

    function onConnect() {
      subscribe();
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onAgentStatus(payload: { labId: string; connected: boolean }) {
      if (payload.labId === labId) {
        setConnected(payload.connected);
      }
    }

    function onMetrics(payload: LabMetrics) {
      if (payload.labId !== labId) return;
      setConnected(true);
      setMetrics(payload);
      setLastUpdated(new Date());
      const memPct =
        payload.memory.totalBytes > 0
          ? Math.round((payload.memory.activeBytes / payload.memory.totalBytes) * 100)
          : 0;
      setHistory((prev) => [
        ...prev.slice(-(MAX_HISTORY - 1)),
        { t: Date.now(), cpu: Math.round(payload.cpu.usagePercent), mem: memPct },
      ]);
    }

    if (socket.connected) {
      subscribe();
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("lab:agent-status", onAgentStatus);
    socket.on("lab:metrics", onMetrics);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("lab:agent-status", onAgentStatus);
      socket.off("lab:metrics", onMetrics);
    };
  }, [labId]);

  return { metrics, connected, lastUpdated, history };
}
