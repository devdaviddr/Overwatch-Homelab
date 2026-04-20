import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api.ts";
import type { Alert, CursorPage } from "@overwatch/shared-types";

type Status = "active" | "resolved" | "all";

export function useAlerts(token: string | null, labId: string | undefined, status: Status = "all") {
  return useQuery<Alert[]>({
    queryKey: ["alerts", labId, status],
    queryFn: async () => {
      const qs = new URLSearchParams({ status, limit: "100" });
      const res = await apiFetch(`/api/homelabs/${labId}/alerts?${qs}`, { token });
      const page = res.data as CursorPage<Alert>;
      return page.items;
    },
    enabled: !!token && !!labId,
    refetchInterval: 30_000,
  });
}

export function useAcknowledgeAlert(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ labId, alertId }: { labId: string; alertId: string }) => {
      await apiFetch(`/api/homelabs/${labId}/alerts/${alertId}/acknowledge`, {
        token,
        method: "POST",
      });
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["alerts", vars.labId] });
    },
  });
}
