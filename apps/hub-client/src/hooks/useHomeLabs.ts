import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api.ts";
import type { HomeLab } from "@overwatch/shared-types";

export function useHomeLabs(token: string | null) {
  return useQuery<HomeLab[]>({
    queryKey: ["homelabs"],
    queryFn: async () => {
      const res = await apiFetch("/api/homelabs", { token });
      return res.data as HomeLab[];
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
