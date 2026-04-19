import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api.ts";
import type { HomeLab, StoragePool } from "@overwatch/shared-types";

export function useCreateHomeLab(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation<HomeLab, Error, { name: string; description?: string }>({
    mutationFn: async (body) => {
      const res = await apiFetch<HomeLab>("/api/homelabs", {
        method: "POST",
        token,
        body,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homelabs"] });
    },
  });
}

export function useCreateStoragePool(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation<
    StoragePool,
    Error,
    { homeLabId: string; name: string; totalBytes: number }
  >({
    mutationFn: async ({ homeLabId, ...body }) => {
      const res = await apiFetch<StoragePool>(
        `/api/homelabs/${homeLabId}/storage-pools`,
        { method: "POST", token, body }
      );
      return res.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["homelabs", vars.homeLabId] });
    },
  });
}
