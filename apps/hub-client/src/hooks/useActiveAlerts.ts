import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api.ts";
import type { Alert, CursorPage } from "@overwatch/shared-types";

// Lightweight fetch of active alerts for a single lab — used by the sidebar
// to render a badge on resources that have open alerts.
export function useActiveAlertCount(token: string | null, labId: string) {
  return useQuery<number>({
    queryKey: ["alerts", labId, "active", "count"],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/homelabs/${labId}/alerts?status=active&limit=100`,
        { token }
      );
      const page = res.data as CursorPage<Alert>;
      return page.items.length;
    },
    enabled: !!token && !!labId,
    refetchInterval: 60_000,
  });
}
