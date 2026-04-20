import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/auth.js";
import { homeLabRouter } from "./routes/homelabs.js";
import { agentsRouter } from "./routes/agents.js";
import { agentLauncherRouter } from "./routes/agentLauncher.js";
import { setupSocketServer } from "./socket/agentSocket.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

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
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
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
setupSocketServer(httpServer, CORS_ORIGIN);

// ── Start ───────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[Hub Server] Listening on http://localhost:${PORT}`);
});
