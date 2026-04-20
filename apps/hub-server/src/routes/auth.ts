import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { authenticate } from "../middleware/auth.js";
import {
  generateRecoveryToken,
  hashRecoveryToken,
  verifyRecoveryToken,
} from "../lib/recoveryToken.js";
import {
  CreateUserSchema,
  LoginSchema,
  UpdateProfileSchema,
  ResetPasswordSchema,
} from "@overwatch/shared-types";

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
  const recoveryToken = generateRecoveryToken();
  const recoveryTokenHash = await hashRecoveryToken(recoveryToken);

  const user = await prisma.user.create({
    data: { email, name, password: hashedPassword, recoveryTokenHash },
    select: { id: true, email: true, name: true },
  });

  const token = signToken({ userId: user.id, email: user.email });

  // recoveryToken is shown ONCE — server keeps only the bcrypt hash.
  res.status(201).json({ success: true, data: { token, user, recoveryToken } });
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

// POST /auth/reset-password — recovery-token-based reset. No email needed.
// Body: { email, recoveryToken, newPassword }. On success:
//   - password is replaced (bcrypt)
//   - recovery token is rotated (the old one is invalidated)
//   - a fresh JWT is returned so the user is logged in immediately
// Returns the new recoveryToken — shown ONCE to the user.
authRouter.post("/reset-password", async (req: Request, res: Response): Promise<void> => {
  const parsed = ResetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    });
    return;
  }

  const { email, recoveryToken, newPassword } = parsed.data;

  // Constant-time-ish: always run a dummy bcrypt when the user is missing
  // or has no recovery token, so response timing is similar either way.
  const user = await prisma.user.findUnique({ where: { email } });

  const dummyHash = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8pFQ5G1w0pw1nx8c1VfO0xkr7Ix5R6";
  if (!user || !user.recoveryTokenHash) {
    await verifyRecoveryToken(recoveryToken, dummyHash).catch(() => false);
    res.status(401).json({
      success: false,
      error: { code: "INVALID_RECOVERY_TOKEN", message: "Email or recovery token is invalid" },
    });
    return;
  }

  const ok = await verifyRecoveryToken(recoveryToken, user.recoveryTokenHash);
  if (!ok) {
    res.status(401).json({
      success: false,
      error: { code: "INVALID_RECOVERY_TOKEN", message: "Email or recovery token is invalid" },
    });
    return;
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  const newRecoveryToken = generateRecoveryToken();
  const newRecoveryTokenHash = await hashRecoveryToken(newRecoveryToken);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: newPasswordHash, recoveryTokenHash: newRecoveryTokenHash },
  });

  const token = signToken({ userId: user.id, email: user.email });

  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      recoveryToken: newRecoveryToken,
    },
  });
});

// POST /auth/recovery-token — authenticated user generates a fresh recovery
// token. Use from the profile page when the user has lost or wants to rotate
// their previous token.
authRouter.post("/recovery-token", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } });
    return;
  }

  const newRecoveryToken = generateRecoveryToken();
  const newRecoveryTokenHash = await hashRecoveryToken(newRecoveryToken);

  await prisma.user.update({
    where: { id: user.id },
    data: { recoveryTokenHash: newRecoveryTokenHash },
  });

  res.json({ success: true, data: { recoveryToken: newRecoveryToken } });
});
