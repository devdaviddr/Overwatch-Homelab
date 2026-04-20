import { z } from "zod";
import { LabMetricsSchema } from "./metrics.js";

// ─────────────────────────────────────────────
// Agent → Hub Socket.io events
// ─────────────────────────────────────────────

export const AgentRegisterPayloadSchema = z.object({
  labId: z.string().uuid(),
  agentVersion: z.string(),
  hostname: z.string().optional(),
});

export type AgentRegisterPayload = z.infer<typeof AgentRegisterPayloadSchema>;

export const AgentHeartbeatPayloadSchema = z.object({
  labId: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export type AgentHeartbeatPayload = z.infer<typeof AgentHeartbeatPayloadSchema>;

export const AgentMetricsPayloadSchema = LabMetricsSchema;
export type AgentMetricsPayload = z.infer<typeof AgentMetricsPayloadSchema>;

// ─────────────────────────────────────────────
// Hub → Agent Socket.io events
// ─────────────────────────────────────────────

export const HubAckPayloadSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type HubAckPayload = z.infer<typeof HubAckPayloadSchema>;

// ─────────────────────────────────────────────
// Event name constants
// ─────────────────────────────────────────────

export const AgentEvents = {
  REGISTER: "agent:register",
  HEARTBEAT: "agent:heartbeat",
  METRICS: "agent:metrics",
  DISCONNECT: "agent:disconnect",
} as const;

export const HubEvents = {
  ACK: "hub:ack",
  ERROR: "hub:error",
} as const;

export type AgentEventName = (typeof AgentEvents)[keyof typeof AgentEvents];
export type HubEventName = (typeof HubEvents)[keyof typeof HubEvents];
