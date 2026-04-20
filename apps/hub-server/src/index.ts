import "dotenv/config";
import { env } from "./lib/env.js";
import http from "http";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/auth.js";
import { homeLabRouter } from "./routes/homelabs.js";
import { agentsRouter } from "./routes/agents.js";
import { agentLauncherRouter } from "./routes/agentLauncher.js";
import { setupSocketServer, onAgentMetrics } from "./socket/agentSocket.js";
import { persistMetricSnapshot, evaluateAlerts, startRetentionPruner } from "./lib/metrics.js";

const app = express();
const httpServer = http.createServer(app);

// ── Rate limiting ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many requests, please try again later" } },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many requests, please try again later" } },
});

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/homelabs", apiLimiter, homeLabRouter);
app.use("/api/agents", apiLimiter, agentsRouter);
app.use("/api/agent", apiLimiter, agentLauncherRouter);

// ── Socket.io ───────────────────────────────────────────────────────────────
const io = setupSocketServer(httpServer, env.CORS_ORIGIN);

// ── Metrics persistence + alert evaluation ──────────────────────────────────
// Runs out-of-band from the live broadcast path — errors are logged but
// never bubble back to the agent.
onAgentMetrics(async (payload) => {
  try {
    await persistMetricSnapshot(payload);
  } catch (err) {
    // P2003 = FK violation. Happens when an agent pushes for a lab that
    // was deleted out from under it (or — pre-H3-register-guard — a lab
    // that never existed). Log a one-liner; stack trace isn't useful.
    if ((err as { code?: string } | null)?.code === "P2003") {
      console.warn(`[Metrics] snapshot persist skipped — unknown labId=${payload.labId}`);
    } else {
      console.error("[Metrics] snapshot persist failed:", err);
    }
    return;
  }
  try {
    await evaluateAlerts(payload, io);
  } catch (err) {
    console.error("[Metrics] alert eval failed:", err);
  }
});

// ── Retention pruner (every 6 h) ────────────────────────────────────────────
startRetentionPruner();

// ── Start ───────────────────────────────────────────────────────────────────
httpServer.listen(env.PORT, () => {
  console.log(`[Hub Server] Listening on http://localhost:${env.PORT}`);
});
