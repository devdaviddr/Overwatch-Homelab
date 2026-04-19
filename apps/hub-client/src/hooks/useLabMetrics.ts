import { useEffect, useState } from "react";
import type { LabMetrics } from "@overwatch/shared-types";
import { getSocket } from "../lib/socket.ts";

interface LabMetricsState {
  metrics: LabMetrics | null;
  connected: boolean;
  lastUpdated: Date | null;
}

export function useLabMetrics(labId: string | undefined): LabMetricsState {
  const [metrics, setMetrics] = useState<LabMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
      if (payload.labId === labId) {
        setMetrics(payload);
        setLastUpdated(new Date());
      }
    }

    // Subscribe immediately if already connected
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

  return { metrics, connected, lastUpdated };
}
