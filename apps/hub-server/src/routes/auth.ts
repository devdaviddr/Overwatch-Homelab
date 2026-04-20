import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { authenticate } from "../middleware/auth.js";
import { CreateUserSchema, LoginSchema, UpdateProfileSchema } from "@overwatch/shared-types";

export const authRouter = Router();

// POST /auth/register
authRouter.post("/register", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    });
    return;
  }

  const { email, name, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({
      success: false,
      error: { code: "CONFLICT", message: "Email already registered" },
    });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, password: hashedPassword },
    select: { id: true, email: true, name: true },
  });

  const token = signToken({ userId: user.id, email: user.email });

  res.status(201).json({ success: true, data: { token, user } });
});

// POST /auth/login
authRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    });
    return;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid credentials" },
    });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid credentials" },
    });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });

  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    },
  });
});

// PATCH /auth/profile — update name and/or password. Requires auth.
// Password changes require currentPassword and the new password must meet
// the v0.2.0 policy (H6).
authRouter.patch("/profile", authenticate, async (req: Request, res: Response): Promise<void> => {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } });
    return;
  }

  const updates: { name?: string; password?: string } = {};

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name;
  }

  if (parsed.data.newPassword !== undefined) {
    const ok = await bcrypt.compare(parsed.data.currentPassword!, user.password);
    if (!ok) {
      res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect" },
      });
      return;
    }
    updates.password = await bcrypt.hash(parsed.data.newPassword, 12);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updates,
    select: { id: true, email: true, name: true },
  });

  res.json({ success: true, data: updated });
});
