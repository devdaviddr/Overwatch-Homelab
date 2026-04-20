import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api.ts";
import type { HomeLab, ResourceType, AlertThresholds } from "@overwatch/shared-types";

export function useCreateHomeLab(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation<
    HomeLab,
    Error,
    {
      name: string;
      description?: string;
      resourceType?: ResourceType;
      labels?: string[];
      agentHubUrl?: string | null;
      heartbeatIntervalMs?: number;
      metricsIntervalMs?: number;
    }
  >({
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

export function useUpdateHomeLab(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation<
    HomeLab,
    Error,
    {
      id: string;
      name?: string;
      description?: string | null;
      resourceType?: ResourceType;
      labels?: string[];
      agentHubUrl?: string | null;
      heartbeatIntervalMs?: number;
      metricsIntervalMs?: number;
      retentionDays?: number;
      alertThresholds?: AlertThresholds | null;
    }
  >({
    mutationFn: async ({ id, ...body }) => {
      const res = await apiFetch<HomeLab>(`/api/homelabs/${id}`, {
        method: "PATCH",
        token,
        body,
      });
      return res.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["homelabs"] });
      queryClient.invalidateQueries({ queryKey: ["homelabs", vars.id] });
    },
  });
}

export function useDeleteHomeLab(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiFetch(`/api/homelabs/${id}`, { method: "DELETE", token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homelabs"] });
    },
  });
}
