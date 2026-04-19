import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { AgentEvents, HubEvents } from "@overwatch/shared-types";
import type {
  AgentRegisterPayload,
  AgentHeartbeatPayload,
  AgentMetricsPayload,
} from "@overwatch/shared-types";

interface ConnectedAgent {
  labId: string;
  hostname: string;
  agentVersion: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

const connectedAgents = new Map<string, ConnectedAgent>();

export function setupSocketServer(httpServer: HttpServer, corsOrigin: string): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // Agent registers itself with a labId
    socket.on(AgentEvents.REGISTER, (payload: AgentRegisterPayload) => {
      console.log(`[Socket] Agent registered: labId=${payload.labId}, host=${payload.hostname}`);

      const agent: ConnectedAgent = {
        labId: payload.labId,
        hostname: payload.hostname,
        agentVersion: payload.agentVersion,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      };

      connectedAgents.set(socket.id, agent);
      socket.join(`lab:${payload.labId}`);

      socket.emit(HubEvents.ACK, { success: true, message: "Registered successfully" });
    });

    // Heartbeat from agent
    socket.on(AgentEvents.HEARTBEAT, (payload: AgentHeartbeatPayload) => {
      const agent = connectedAgents.get(socket.id);
      if (agent) {
        agent.lastHeartbeat = new Date(payload.timestamp);
        console.log(`[Socket] Heartbeat from labId=${payload.labId}`);
      }
    });

    // Metrics report from agent
    socket.on(AgentEvents.METRICS, (payload: AgentMetricsPayload) => {
      console.log(`[Socket] Metrics received from labId=${payload.labId}`);
      // Broadcast metrics to any dashboard clients listening to this lab's room
      io.to(`lab:${payload.labId}`).emit("lab:metrics", payload);
    });

    // Cleanup on disconnect
    socket.on("disconnect", () => {
      const agent = connectedAgents.get(socket.id);
      if (agent) {
        console.log(`[Socket] Agent disconnected: labId=${agent.labId}`);
        connectedAgents.delete(socket.id);
      }
    });
  });

  return io;
}

export function getConnectedAgents(): ConnectedAgent[] {
  return Array.from(connectedAgents.values());
}
