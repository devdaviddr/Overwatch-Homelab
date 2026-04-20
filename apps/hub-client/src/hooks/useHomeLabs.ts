import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api.ts";
import type { HomeLab, CursorPage } from "@overwatch/shared-types";

// v0.2.0: the hub returns { items, nextCursor, hasMore }. The sidebar and
// overview pages currently show the first page only; full pagination UI is
// deferred. Request the maximum page size so small fleets stay single-page.
export function useHomeLabs(token: string | null) {
  return useQuery<HomeLab[]>({
    queryKey: ["homelabs"],
    queryFn: async () => {
      const res = await apiFetch("/api/homelabs?limit=200", { token });
      const data = res.data as CursorPage<HomeLab> | HomeLab[];
      if (Array.isArray(data)) return data; // tolerate legacy shape
      return data.items;
    },
    enabled: !!token,
  });
}

export function useHomeLab(token: string | null, labId: string | undefined) {
  return useQuery<HomeLab>({
    queryKey: ["homelabs", labId],
    queryFn: async () => {
      const res = await apiFetch(`/api/homelabs/${labId}`, { token });
      return res.data as HomeLab;
    },
    enabled: !!token && !!labId,
  });
}
