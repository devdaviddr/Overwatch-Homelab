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

// v0.2.0 password policy (H6): min 12, at least one letter and one digit.
// Applied at registration and profile password change.
export const PasswordPolicySchema = z
  .string()
  .min(12, { message: "Password must be at least 12 characters" })
  .refine((v) => /[A-Za-z]/.test(v), { message: "Password must contain at least one letter" })
  .refine((v) => /[0-9]/.test(v), { message: "Password must contain at least one digit" });

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: PasswordPolicySchema,
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateProfileSchema = z
  .object({
    name: z.string().min(1).optional(),
    currentPassword: z.string().optional(),
    newPassword: PasswordPolicySchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.newPassword !== undefined, {
    message: "At least one of name or newPassword is required",
  })
  .refine((v) => v.newPassword === undefined || (v.currentPassword !== undefined && v.currentPassword.length > 0), {
    message: "currentPassword is required when changing password",
    path: ["currentPassword"],
  });

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ─────────────────────────────────────────────
// Resource
// ─────────────────────────────────────────────

export const ResourceTypeSchema = z.enum(["HOMELAB", "SERVER", "PC"]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

// ─────────────────────────────────────────────
// HomeLab / Resource
// ─────────────────────────────────────────────

export const AlertThresholdsSchema = z.object({
  cpuPercent: z.number().min(0).max(100),
  memPercent: z.number().min(0).max(100),
  diskPercent: z.number().min(0).max(100),
  consecutiveBreaches: z.number().int().min(1).max(60),
});

export type AlertThresholds = z.infer<typeof AlertThresholdsSchema>;

export const HomeLabSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  resourceType: ResourceTypeSchema,
  labels: z.array(z.string()),
  ownerId: z.string().uuid(),
  agentHubUrl: z.string().url().nullable().optional(),
  heartbeatIntervalMs: z.number().int().optional(),
  metricsIntervalMs: z.number().int().optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
  alertThresholds: AlertThresholdsSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type HomeLab = z.infer<typeof HomeLabSchema>;

export const CreateHomeLabSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  resourceType: ResourceTypeSchema.default("HOMELAB"),
  labels: z.array(z.string()).default([]),
  agentHubUrl: z.string().url().optional().nullable(),
  heartbeatIntervalMs: z.number().int().min(1000).optional(),
  metricsIntervalMs: z.number().int().min(5000).optional(),
});

export type CreateHomeLabInput = z.infer<typeof CreateHomeLabSchema>;
