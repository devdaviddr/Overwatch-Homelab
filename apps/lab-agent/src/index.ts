import "dotenv/config";
import { io } from "socket.io-client";
import { AgentEvents, HubEvents } from "@overwatch/shared-types";
import type { HubReassignPayload } from "@overwatch/shared-types";
import { collectMetrics } from "./metrics.js";

const HUB_URL = process.env.HUB_URL ?? "http://localhost:3001";
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS ?? "15000", 10);
const METRICS_INTERVAL_MS = parseInt(process.env.METRICS_INTERVAL_MS ?? "60000", 10);
const AGENT_VERSION = "1.0.0";

let currentLabId = process.env.LAB_ID ?? "";

if (!currentLabId) {
  console.error("[Agent] LAB_ID environment variable is required");
  process.exit(1);
}

console.log(`[Agent] Connecting to hub at ${HUB_URL} as labId=${currentLabId}`);

const socket = io(HUB_URL, {
  reconnection: true,
  reconnectionDelay: 5000,
  reconnectionAttempts: Infinity,
});

socket.on("connect", () => {
  console.log(`[Agent] Connected to hub (socketId=${socket.id})`);
  register();
});

socket.on("disconnect", (reason) => {
  console.warn(`[Agent] Disconnected: ${reason}`);
});

socket.on("connect_error", (err) => {
  console.error(`[Agent] Connection error: ${err.message}`);
});

socket.on(HubEvents.ACK, (payload: { success: boolean; message?: string }) => {
  console.log(`[Agent] Hub ACK: ${payload.message ?? "ok"}`);
  sendMetrics();
});

socket.on(HubEvents.REASSIGN, (payload: HubReassignPayload) => {
  console.log(`[Agent] Reassigned: ${currentLabId} → ${payload.newLabId}`);
  currentLabId = payload.newLabId;
  register();
});

function register(): void {
  socket.emit(AgentEvents.REGISTER, {
    labId: currentLabId,
    agentVersion: AGENT_VERSION,
  });
}

function sendHeartbeat(): void {
  socket.emit(AgentEvents.HEARTBEAT, {
    labId: currentLabId,
    timestamp: new Date().toISOString(),
  });
}

async function sendMetrics(): Promise<void> {
  try {
    const metrics = await collectMetrics(currentLabId);
    socket.emit(AgentEvents.METRICS, metrics);
    console.log(`[Agent] Metrics sent for labId=${currentLabId}`);
  } catch (err) {
    console.error("[Agent] Failed to collect metrics:", err);
  }
}

setInterval(() => {
  if (socket.connected) sendHeartbeat();
}, HEARTBEAT_INTERVAL_MS);

setInterval(() => {
  if (socket.connected) sendMetrics();
}, METRICS_INTERVAL_MS);

console.log(`[Agent] Running. Heartbeat every ${HEARTBEAT_INTERVAL_MS}ms, metrics every ${METRICS_INTERVAL_MS}ms`);
