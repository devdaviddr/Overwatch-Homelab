import { Router, Request, Response } from "express";
import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { authenticate } from "../middleware/auth.js";
import { z } from "zod";

// Repo root is 4 levels up from this source file:
// src/routes/agentLauncher.ts -> src -> hub-server -> apps -> repo root
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const TSX_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");
const AGENT_ENTRY = path.join(REPO_ROOT, "apps", "lab-agent", "src", "index.ts");

const LaunchBodySchema = z.object({
  hubUrl: z.string().url(),
  heartbeatIntervalMs: z.number().int().min(1000),
  metricsIntervalMs: z.number().int().min(5000),
});

// Module-level map of labId -> running child process
const runningAgents = new Map<string, ChildProcess>();

function isDocker(): boolean {
  return existsSync("/.dockerenv");
}

export const agentLauncherRouter = Router();

agentLauncherRouter.use(authenticate);

// GET /agent/capabilities
agentLauncherRouter.get("/capabilities", (_req: Request, res: Response): void => {
  if (isDocker()) {
    res.json({ canLaunch: false, reason: "docker" });
    return;
  }
  res.json({ canLaunch: true });
});

// POST /agent/:labId/launch
agentLauncherRouter.post("/:labId/launch", (req: Request, res: Response): void => {
  if (isDocker()) {
    res.status(400).json({ launched: false, reason: "docker" });
    return;
  }

  const parsed = LaunchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      launched: false,
      reason: "invalid_body",
      details: parsed.error.flatten(),
    });
    return;
  }

  const { labId } = req.params;
  const { hubUrl, heartbeatIntervalMs, metricsIntervalMs } = parsed.data;

  // Kill existing agent for this lab if one is running
  const existing = runningAgents.get(labId);
  if (existing) {
    try {
      existing.kill();
    } catch {
      // Ignore errors killing the old process
    }
    runningAgents.delete(labId);
  }

  // Verify tsx binary exists before spawning
  if (!existsSync(TSX_BIN)) {
    res.status(500).json({ launched: false, reason: "tsx_not_found" });
    return;
  }

  let child: ChildProcess;
  try {
    child = spawn(TSX_BIN, [AGENT_ENTRY], {
      detached: false,
      stdio: "ignore",
      env: {
        ...process.env,
        LAB_ID: labId,
        HUB_URL: hubUrl,
        HEARTBEAT_INTERVAL_MS: String(heartbeatIntervalMs),
        METRICS_INTERVAL_MS: String(metricsIntervalMs),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ launched: false, reason: message });
    return;
  }

  // If spawn failed immediately (pid undefined), report error
  if (!child.pid) {
    res.status(500).json({ launched: false, reason: "spawn_failed" });
    return;
  }

  runningAgents.set(labId, child);

  child.on("exit", () => {
    // Clean up map entry when the child exits
    if (runningAgents.get(labId) === child) {
      runningAgents.delete(labId);
    }
  });

  res.json({ launched: true, pid: child.pid });
});

// GET /agent/:labId/launch
agentLauncherRouter.get("/:labId/launch", (req: Request, res: Response): void => {
  const { labId } = req.params;
  const child = runningAgents.get(labId);
  if (child?.pid) {
    res.json({ running: true, pid: child.pid });
  } else {
    res.json({ running: false });
  }
});

// DELETE /agent/:labId/launch
agentLauncherRouter.delete("/:labId/launch", (req: Request, res: Response): void => {
  const { labId } = req.params;
  const child = runningAgents.get(labId);

  if (!child) {
    res.json({ stopped: false });
    return;
  }

  try {
    child.kill();
  } catch {
    // Process may have already exited
  }
  runningAgents.delete(labId);
  res.json({ stopped: true });
});
