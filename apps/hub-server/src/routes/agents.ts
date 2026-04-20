import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { getConnectedAgents } from "../socket/agentSocket.js";

export const agentsRouter = Router();
agentsRouter.use(authenticate);

agentsRouter.get("/", (_req: Request, res: Response): void => {
  const agents = getConnectedAgents().map((a) => ({
    socketId: a.socketId,
    labId: a.labId,
    agentVersion: a.agentVersion,
    connectedAt: a.connectedAt.toISOString(),
    lastHeartbeat: a.lastHeartbeat.toISOString(),
  }));
  res.json({ success: true, data: agents });
});
