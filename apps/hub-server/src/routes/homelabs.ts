import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { CreateHomeLabSchema } from "@overwatch/shared-types";
import { z } from "zod";

const UpdateHomeLabSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  resourceType: z.enum(["HOMELAB", "SERVER", "PC"]).optional(),
  labels: z.array(z.string()).optional(),
  agentHubUrl: z.string().url().optional().nullable(),
  heartbeatIntervalMs: z.number().int().min(1000).optional(),
  metricsIntervalMs: z.number().int().min(5000).optional(),
});

export const homeLabRouter = Router();

homeLabRouter.use(authenticate);

// GET /homelabs – list the current user's homelabs
homeLabRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  const labs = await prisma.homeLab.findMany({
    where: { ownerId: req.user!.userId },
    orderBy: { createdAt: "asc" },
  });
  res.json({ success: true, data: labs });
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

  const updated = await prisma.homeLab.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  res.json({ success: true, data: updated });
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
