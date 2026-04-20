import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { AgentEvents, HubEvents } from "@overwatch/shared-types";
import type {
  AgentRegisterPayload,
  AgentHeartbeatPayload,
  AgentMetricsPayload,
} from "@overwatch/shared-types";

export interface ConnectedAgent {
  socketId: string;
  labId: string;
  agentVersion: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

const connectedAgents = new Map<string, ConnectedAgent>();
let ioInstance: SocketServer | null = null;

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

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    socket.on(AgentEvents.REGISTER, (payload: AgentRegisterPayload) => {
      const existing = connectedAgents.get(socket.id);
      if (existing) {
        socket.leave(`lab:${existing.labId}`);
        // Notify dashboard clients that the old lab lost its agent (if none left)
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
      };

      connectedAgents.set(socket.id, agent);
      socket.join(`lab:${payload.labId}`);
      socket.emit(HubEvents.ACK, { success: true, message: "Registered successfully" });

      // Notify any dashboard clients already subscribed to this lab
      io.to(`lab:${payload.labId}`).emit("lab:agent-status", { labId: payload.labId, connected: true });
    });

    socket.on("dashboard:subscribe", (payload: { labId: string }) => {
      if (!payload?.labId) return;
      socket.join(`lab:${payload.labId}`);
      console.log(`[Socket] Dashboard subscribed to lab:${payload.labId}`);

      // Immediately tell this subscriber the current agent status for the lab
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
    });

    socket.on("disconnect", () => {
      const agent = connectedAgents.get(socket.id);
      if (agent) {
        console.log(`[Socket] Agent disconnected: labId=${agent.labId}`);
        connectedAgents.delete(socket.id);
        // Notify dashboard if no other agent is still serving this lab
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

  // Update status for both labs
  if (!agentOnlineForLab(oldLabId)) {
    ioInstance.to(`lab:${oldLabId}`).emit("lab:agent-status", { labId: oldLabId, connected: false });
  }
  ioInstance.to(`lab:${newLabId}`).emit("lab:agent-status", { labId: newLabId, connected: true });

  return true;
}
