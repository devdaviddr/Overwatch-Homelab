import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api.ts";
import type { MetricsRangeResponse } from "@overwatch/shared-types";
import type { TimeRange } from "../components/TimeRangeSelector.tsx";

const RANGE_CONFIG: Record<TimeRange, { windowMs: number; resolution: "1m" | "5m" | "1h" }> = {
  "1h": { windowMs: 60 * 60 * 1000, resolution: "1m" },
  "6h": { windowMs: 6 * 60 * 60 * 1000, resolution: "5m" },
  "24h": { windowMs: 24 * 60 * 60 * 1000, resolution: "5m" },
  "7d": { windowMs: 7 * 24 * 60 * 60 * 1000, resolution: "1h" },
};

export function useMetricsHistory(
  token: string | null,
  labId: string | undefined,
  range: TimeRange
) {
  const { windowMs, resolution } = RANGE_CONFIG[range];

  return useQuery<MetricsRangeResponse>({
    queryKey: ["metrics-history", labId, range],
    queryFn: async () => {
      const to = new Date();
      const from = new Date(to.getTime() - windowMs);
      const qs = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        resolution,
      });
      const res = await apiFetch(`/api/homelabs/${labId}/metrics?${qs}`, { token });
      return res.data as MetricsRangeResponse;
    },
    enabled: !!token && !!labId,
    // 1h/6h refresh every 30 s so the chart tracks live activity; coarser
    // ranges refresh every 5 min to save the server.
    refetchInterval: range === "1h" || range === "6h" ? 30_000 : 5 * 60_000,
  });
}
