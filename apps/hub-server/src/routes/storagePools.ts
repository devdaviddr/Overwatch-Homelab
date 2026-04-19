import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { CreateStoragePoolSchema } from "@overwatch/shared-types";

export const storagePoolRouter = Router();

storagePoolRouter.use(authenticate);

// GET /homelabs/:homeLabId/storage-pools
storagePoolRouter.get(
  "/:homeLabId/storage-pools",
  async (req: Request, res: Response): Promise<void> => {
    // Verify the homelab belongs to this user
    const lab = await prisma.homeLab.findFirst({
      where: { id: req.params.homeLabId, ownerId: req.user!.userId },
    });
    if (!lab) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "HomeLab not found" },
      });
      return;
    }

    const pools = await prisma.storagePool.findMany({
      where: { homeLabId: req.params.homeLabId },
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, data: pools });
  }
);

// POST /homelabs/:homeLabId/storage-pools
storagePoolRouter.post(
  "/:homeLabId/storage-pools",
  async (req: Request, res: Response): Promise<void> => {
    const lab = await prisma.homeLab.findFirst({
      where: { id: req.params.homeLabId, ownerId: req.user!.userId },
    });
    if (!lab) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "HomeLab not found" },
      });
      return;
    }

    const parsed = CreateStoragePoolSchema.safeParse({
      ...req.body,
      homeLabId: req.params.homeLabId,
    });
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const pool = await prisma.storagePool.create({ data: parsed.data });
    res.status(201).json({ success: true, data: pool });
  }
);

// DELETE /homelabs/:homeLabId/storage-pools/:poolId
storagePoolRouter.delete(
  "/:homeLabId/storage-pools/:poolId",
  async (req: Request, res: Response): Promise<void> => {
    const lab = await prisma.homeLab.findFirst({
      where: { id: req.params.homeLabId, ownerId: req.user!.userId },
    });
    if (!lab) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "HomeLab not found" },
      });
      return;
    }

    const pool = await prisma.storagePool.findFirst({
      where: { id: req.params.poolId, homeLabId: req.params.homeLabId },
    });
    if (!pool) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "StoragePool not found" },
      });
      return;
    }

    await prisma.storagePool.delete({ where: { id: req.params.poolId } });
    res.status(204).send();
  }
);
