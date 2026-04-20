import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import {
  CreateHomeLabSchema,
  AlertThresholdsSchema,
  MetricsRangeQuerySchema,
  PaginationQuerySchema,
  type MetricPoint,
  type MetricsRangeResponse,
} from "@overwatch/shared-types";
import { reassignAgent } from "../socket/agentSocket.js";
import { encodeCursor, decodeCursor } from "../lib/pagination.js";
import { bucketize, RESOLUTION_MS } from "../lib/downsample.js";
import { z } from "zod";

const UpdateHomeLabSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  resourceType: z.enum(["HOMELAB", "SERVER", "PC"]).optional(),
  labels: z.array(z.string()).optional(),
  agentHubUrl: z.string().url().optional().nullable(),
  heartbeatIntervalMs: z.number().int().min(1000).optional(),
  metricsIntervalMs: z.number().int().min(5000).optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
  alertThresholds: AlertThresholdsSchema.nullable().optional(),
});

export const homeLabRouter = Router();

homeLabRouter.use(authenticate);

// GET /homelabs — cursor-paginated list of the current user's homelabs.
// Stable ordering via (createdAt ASC, id ASC) so the cursor stays valid
// across inserts.
homeLabRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = PaginationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid pagination params", details: parsed.error.flatten() },
    });
    return;
  }

  const { limit, cursor } = parsed.data;

  let cursorClause = {};
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid cursor" },
      });
      return;
    }
    cursorClause = {
      OR: [
        { createdAt: { gt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { gt: decoded.id } },
      ],
    };
  }

  // Fetch one extra to detect hasMore without a separate count query.
  const rows = await prisma.homeLab.findMany({
    where: { ownerId: req.user!.userId, ...cursorClause },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;

  res.json({ success: true, data: { items, nextCursor, hasMore } });
});

// GET /homelabs/:id
homeLabRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const lab = await prisma.homeLab.findFirst({
    where: { id: req.params.id, ownerId: req.user!.userId },
  });

  if (!lab) {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "HomeLab not found" },
    });
    return;
  }

  res.json({ success: true, data: lab });
});

// POST /homelabs
homeLabRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateHomeLabSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    });
    return;
  }

  const lab = await prisma.homeLab.create({
    data: { ...parsed.data, ownerId: req.user!.userId },
  });

  res.status(201).json({ success: true, data: lab });
});

// PATCH /homelabs/:id
homeLabRouter.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  const lab = await prisma.homeLab.findFirst({
    where: { id: req.params.id, ownerId: req.user!.userId },
  });

  if (!lab) {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "HomeLab not found" },
    });
    return;
  }

  const parsed = UpdateHomeLabSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    });
    return;
  }

  // alertThresholds needs explicit serialisation so Prisma writes it as JSON.
  const { alertThresholds, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (alertThresholds !== undefined) {
    updateData.alertThresholds = alertThresholds === null ? null : (alertThresholds as object);
  }

  const updated = await prisma.homeLab.update({
    where: { id: req.params.id },
    data: updateData,
  });

  res.json({ success: true, data: updated });
});

// POST /homelabs/:id/assign-agent
homeLabRouter.post("/:id/assign-agent", async (req: Request, res: Response): Promise<void> => {
  const lab = await prisma.homeLab.findFirst({
    where: { id: req.params.id, ownerId: req.user!.userId },
  });

  if (!lab) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "HomeLab not found" } });
    return;
  }

  const { socketId } = req.body;
  if (!socketId || typeof socketId !== "string") {
    res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "socketId is required" } });
    return;
  }

  const ok = reassignAgent(socketId, lab.id);
  if (!ok) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Agent not found or not connected" } });
    return;
  }

  res.json({ success: true });
});

// DELETE /homelabs/:id
homeLabRouter.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const lab = await prisma.homeLab.findFirst({
    where: { id: req.params.id, ownerId: req.user!.userId },
  });

  if (!lab) {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "HomeLab not found" },
    });
    return;
  }

  await prisma.homeLab.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// GET /homelabs/:id/metrics — historical metrics over a time window.
// Server-side downsampling via time-bucket averaging.
homeLabRouter.get("/:id/metrics", async (req: Request, res: Response): Promise<void> => {
  const lab = await prisma.homeLab.findFirst({
    where: { id: req.params.id, ownerId: req.user!.userId },
    select: { id: true },
  });
  if (!lab) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "HomeLab not found" } });
    return;
  }

  const parsed = MetricsRangeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid query", details: parsed.error.flatten() },
    });
    return;
  }

  const now = new Date();
  const to = parsed.data.to ? new Date(parsed.data.to) : now;
  const from = parsed.data.from ? new Date(parsed.data.from) : new Date(to.getTime() - 60 * 60 * 1000);
  const resolution = parsed.data.resolution;

  if (from >= to) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "`from` must be earlier than `to`" },
    });
    return;
  }

  const rows = await prisma.metricSnapshot.findMany({
    where: { labId: lab.id, recordedAt: { gte: from, lte: to } },
    orderBy: { recordedAt: "asc" },
    select: {
      recordedAt: true,
      cpuPercent: true,
      memTotalBytes: true,
      memActiveBytes: true,
      diskSnapshots: true,
    },
  });

  const points = bucketize(rows, RESOLUTION_MS[resolution]);

  const body: MetricsRangeResponse = {
    labId: lab.id,
    from: from.toISOString(),
    to: to.toISOString(),
    resolution,
    points,
  };

  res.json({ success: true, data: body });
});

// GET /homelabs/:id/alerts — list alerts (status filter + pagination).
const AlertsQuerySchema = z.object({
  status: z.enum(["active", "resolved", "all"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
});

homeLabRouter.get("/:id/alerts", async (req: Request, res: Response): Promise<void> => {
  const lab = await prisma.homeLab.findFirst({
    where: { id: req.params.id, ownerId: req.user!.userId },
    select: { id: true },
  });
  if (!lab) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "HomeLab not found" } });
    return;
  }

  const parsed = AlertsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid query", details: parsed.error.flatten() },
    });
    return;
  }

  const { status, limit, cursor } = parsed.data;

  const statusFilter =
    status === "active"
      ? { resolvedAt: null }
      : status === "resolved"
      ? { resolvedAt: { not: null } }
      : {};

  let cursorClause = {};
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      // firedAt desc, so next page has firedAt < cursor.createdAt (treating cursor as firedAt+id).
      cursorClause = {
        OR: [
          { firedAt: { lt: decoded.createdAt } },
          { firedAt: decoded.createdAt, id: { lt: decoded.id } },
        ],
      };
    }
  }

  const rows = await prisma.alert.findMany({
    where: { labId: lab.id, ...statusFilter, ...cursorClause },
    orderBy: [{ firedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? encodeCursor({ createdAt: items[items.length - 1].firedAt, id: items[items.length - 1].id })
    : null;

  res.json({ success: true, data: { items, nextCursor, hasMore } });
});

// POST /homelabs/:id/alerts/:alertId/acknowledge — 204 on success.
homeLabRouter.post("/:id/alerts/:alertId/acknowledge", async (req: Request, res: Response): Promise<void> => {
  const lab = await prisma.homeLab.findFirst({
    where: { id: req.params.id, ownerId: req.user!.userId },
    select: { id: true },
  });
  if (!lab) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "HomeLab not found" } });
    return;
  }

  const alert = await prisma.alert.findFirst({
    where: { id: req.params.alertId, labId: lab.id },
  });
  if (!alert) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Alert not found" } });
    return;
  }

  if (alert.acknowledgedAt === null) {
    await prisma.alert.update({
      where: { id: alert.id },
      data: { acknowledgedAt: new Date() },
    });
  }

  res.status(204).send();
});
