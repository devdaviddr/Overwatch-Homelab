import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { AgentEvents, HubEvents } from "@overwatch/shared-types";
import type {
  AgentRegisterPayload,
  AgentHeartbeatPayload,
  AgentMetricsPayload,
} from "@overwatch/shared-types";
import { verifyToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export interface ConnectedAgent {
  socketId: string;
  labId: string;
  agentVersion: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  heartbeatIntervalMs: number;
}

const connectedAgents = new Map<string, ConnectedAgent>();
let ioInstance: SocketServer | null = null;

// Out-of-band handlers run on each agent:metrics event (historical persistence,
// alert evaluation, etc.). They never block the live broadcast path.
type MetricsListener = (payload: AgentMetricsPayload) => void | Promise<void>;
const metricsListeners: MetricsListener[] = [];

export function onAgentMetrics(listener: MetricsListener): () => void {
  metricsListeners.push(listener);
  return () => {
    const i = metricsListeners.indexOf(listener);
    if (i >= 0) metricsListeners.splice(i, 1);
  };
}

// Socket kind — agents connect without a token; dashboard clients must present one.
type SocketKind = "agent" | "dashboard";

declare module "socket.io" {
  interface SocketData {
    kind: SocketKind;
    userId?: string;
  }
}

function agentOnlineForLab(labId: string): boolean {
  for (const a of connectedAgents.values()) {
    if (a.labId === labId) return true;
  }
  return false;
}

export function setupSocketServer(httpServer: HttpServer, corsOrigin: string): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
    },
  });
  ioInstance = io;

  // ── Auth middleware (H3) ─────────────────────────────────────────────────
  // Agent sockets connect with { kind: "agent" } and no token (labId is the
  // capability, per spec). Dashboard sockets must present a valid JWT.
  io.use((socket, next) => {
    const auth = socket.handshake.auth ?? {};
    const kind: SocketKind = auth.kind === "agent" ? "agent" : "dashboard";
    socket.data.kind = kind;

    if (kind === "agent") {
      return next();
    }

    const token = typeof auth.token === "string" ? auth.token : null;
    if (!token) {
      return next(new Error("UNAUTHORIZED: missing token"));
    }
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("UNAUTHORIZED: invalid or expired token"));
    }
  });

  // ── Stale-agent pruner (H7) ──────────────────────────────────────────────
  const PRUNE_INTERVAL_MS = 60_000;
  const STALE_MULTIPLIER = 2.5;
  setInterval(() => {
    const now = Date.now();
    for (const [socketId, agent] of connectedAgents.entries()) {
      const threshold = agent.heartbeatIntervalMs * STALE_MULTIPLIER;
      if (now - agent.lastHeartbeat.getTime() > threshold) {
        connectedAgents.delete(socketId);
        console.log(`[Socket] Pruned stale agent labId=${agent.labId} (last heartbeat ${now - agent.lastHeartbeat.getTime()}ms ago)`);
        if (!agentOnlineForLab(agent.labId)) {
          io.to(`lab:${agent.labId}`).emit("lab:agent-status", { labId: agent.labId, connected: false });
        }
      }
    }
  }, PRUNE_INTERVAL_MS).unref();

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] New connection: ${socket.id} (kind=${socket.data.kind})`);

    socket.on(AgentEvents.REGISTER, async (payload: AgentRegisterPayload) => {
      if (socket.data.kind !== "agent") {
        socket.emit(HubEvents.ERROR, { code: "FORBIDDEN", message: "Dashboard sockets cannot register as agents" });
        return;
      }

      // Look up the lab's configured heartbeat interval for the pruner.
      let heartbeatIntervalMs = 15_000;
      try {
        const lab = await prisma.homeLab.findUnique({ where: { id: payload.labId }, select: { heartbeatIntervalMs: true } });
        if (lab?.heartbeatIntervalMs) heartbeatIntervalMs = lab.heartbeatIntervalMs;
      } catch {
        // Non-fatal — use default interval.
      }

      const existing = connectedAgents.get(socket.id);
      if (existing) {
        socket.leave(`lab:${existing.labId}`);
        if (!agentOnlineForLab(existing.labId)) {
          io.to(`lab:${existing.labId}`).emit("lab:agent-status", { labId: existing.labId, connected: false });
        }
        console.log(`[Socket] Agent re-registered: ${existing.labId} → ${payload.labId}`);
      } else {
        console.log(`[Socket] Agent registered: labId=${payload.labId}`);
      }

      const agent: ConnectedAgent = {
        socketId: socket.id,
        labId: payload.labId,
        agentVersion: payload.agentVersion,
        connectedAt: existing?.connectedAt ?? new Date(),
        lastHeartbeat: new Date(),
        heartbeatIntervalMs,
      };

      connectedAgents.set(socket.id, agent);
      socket.join(`lab:${payload.labId}`);
      socket.emit(HubEvents.ACK, { success: true, message: "Registered successfully" });

      io.to(`lab:${payload.labId}`).emit("lab:agent-status", { labId: payload.labId, connected: true });
    });

    socket.on("dashboard:subscribe", async (payload: { labId: string }) => {
      if (!payload?.labId) return;

      if (socket.data.kind !== "dashboard" || !socket.data.userId) {
        socket.emit(HubEvents.ERROR, { code: "UNAUTHORIZED", message: "Dashboard subscription requires a JWT" });
        return;
      }

      // Ownership check — user may only subscribe to their own labs.
      const lab = await prisma.homeLab.findFirst({
        where: { id: payload.labId, ownerId: socket.data.userId },
        select: { id: true },
      });
      if (!lab) {
        socket.emit(HubEvents.ERROR, { code: "FORBIDDEN", message: "Not authorized for this resource" });
        return;
      }

      socket.join(`lab:${payload.labId}`);
      console.log(`[Socket] Dashboard subscribed to lab:${payload.labId} (user=${socket.data.userId})`);

      const isOnline = agentOnlineForLab(payload.labId);
      socket.emit("lab:agent-status", { labId: payload.labId, connected: isOnline });
    });

    socket.on(AgentEvents.HEARTBEAT, (payload: AgentHeartbeatPayload) => {
      const agent = connectedAgents.get(socket.id);
      if (agent) {
        agent.lastHeartbeat = new Date(payload.timestamp);
        console.log(`[Socket] Heartbeat from labId=${payload.labId}`);
      }
    });

    socket.on(AgentEvents.METRICS, (payload: AgentMetricsPayload) => {
      console.log(`[Socket] Metrics received from labId=${payload.labId}`);
      io.to(`lab:${payload.labId}`).emit("lab:metrics", payload);
      for (const h of metricsListeners) {
        // Persistence + alert evaluation run out-of-band (never blocks broadcast).
        Promise.resolve()
          .then(() => h(payload))
          .catch((err) => console.error("[Socket] metrics listener error:", err));
      }
    });

    socket.on("disconnect", () => {
      const agent = connectedAgents.get(socket.id);
      if (agent) {
        console.log(`[Socket] Agent disconnected: labId=${agent.labId}`);
        connectedAgents.delete(socket.id);
        if (!agentOnlineForLab(agent.labId)) {
          io.to(`lab:${agent.labId}`).emit("lab:agent-status", { labId: agent.labId, connected: false });
        }
      }
    });
  });

  return io;
}

export function getConnectedAgents(): ConnectedAgent[] {
  return Array.from(connectedAgents.values());
}

export function reassignAgent(socketId: string, newLabId: string): boolean {
  if (!ioInstance) return false;
  const agent = connectedAgents.get(socketId);
  if (!agent) return false;
  const socket = ioInstance.sockets.sockets.get(socketId);
  if (!socket) return false;

  const oldLabId = agent.labId;
  socket.leave(`lab:${oldLabId}`);
  agent.labId = newLabId;
  socket.join(`lab:${newLabId}`);
  socket.emit(HubEvents.REASSIGN, { newLabId });
  console.log(`[Socket] Agent ${socketId} reassigned to labId=${newLabId}`);

  if (!agentOnlineForLab(oldLabId)) {
    ioInstance.to(`lab:${oldLabId}`).emit("lab:agent-status", { labId: oldLabId, connected: false });
  }
  ioInstance.to(`lab:${newLabId}`).emit("lab:agent-status", { labId: newLabId, connected: true });

  return true;
}
