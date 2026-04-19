import { z } from "zod";

// ─────────────────────────────────────────────
// User
// ─────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ─────────────────────────────────────────────
// HomeLab
// ─────────────────────────────────────────────

export const HomeLabSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type HomeLab = z.infer<typeof HomeLabSchema>;

export const CreateHomeLabSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export type CreateHomeLabInput = z.infer<typeof CreateHomeLabSchema>;
