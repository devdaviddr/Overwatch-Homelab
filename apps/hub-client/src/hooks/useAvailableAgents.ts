import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api.ts";

export interface ConnectedAgent {
  socketId: string;
  labId: string;
  agentVersion: string;
  connectedAt: string;
  lastHeartbeat: string;
}

export function useAvailableAgents(token: string | null) {
  return useQuery<ConnectedAgent[]>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await apiFetch<ConnectedAgent[]>("/api/agents", { token });
      return res.data;
    },
    enabled: !!token,
    refetchInterval: 10_000,
  });
}
