import "dotenv/config";
import os from "os";
import { io } from "socket.io-client";
import { AgentEvents, HubEvents } from "@overwatch/shared-types";
import { collectMetrics } from "./metrics.js";

const HUB_URL = process.env.HUB_URL ?? "http://localhost:3001";
const LAB_ID = process.env.LAB_ID ?? "";
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS ?? "15000", 10);
const METRICS_INTERVAL_MS = parseInt(process.env.METRICS_INTERVAL_MS ?? "60000", 10);
const AGENT_VERSION = "1.0.0";

if (!LAB_ID) {
  console.error("[Agent] LAB_ID environment variable is required");
  process.exit(1);
}

console.log(`[Agent] Connecting to hub at ${HUB_URL} as labId=${LAB_ID}`);

const socket = io(HUB_URL, {
  reconnection: true,
  reconnectionDelay: 5000,
  reconnectionAttempts: Infinity,
});

// ── Connection lifecycle ────────────────────────────────────────────────────

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
});

// ── Agent actions ───────────────────────────────────────────────────────────

function register(): void {
  socket.emit(AgentEvents.REGISTER, {
    labId: LAB_ID,
    agentVersion: AGENT_VERSION,
    hostname: os.hostname(),
  });
}

function sendHeartbeat(): void {
  socket.emit(AgentEvents.HEARTBEAT, {
    labId: LAB_ID,
    timestamp: new Date().toISOString(),
  });
}

function sendMetrics(): void {
  const metrics = collectMetrics(LAB_ID);
  socket.emit(AgentEvents.METRICS, metrics);
  console.log(`[Agent] Metrics sent for labId=${LAB_ID}`);
}

// ── Intervals ───────────────────────────────────────────────────────────────

setInterval(() => {
  if (socket.connected) {
    sendHeartbeat();
  }
}, HEARTBEAT_INTERVAL_MS);

setInterval(() => {
  if (socket.connected) {
    sendMetrics();
  }
}, METRICS_INTERVAL_MS);

console.log(`[Agent] Running. Heartbeat every ${HEARTBEAT_INTERVAL_MS}ms, metrics every ${METRICS_INTERVAL_MS}ms`);
