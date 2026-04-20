import { z } from "zod";

// ─────────────────────────────────────────────
// Generic API response wrappers
// ─────────────────────────────────────────────

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// ─────────────────────────────────────────────
// Auth response
// ─────────────────────────────────────────────

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
  }),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────

// Legacy offset pagination — kept for any callers still on v0.1.x shape.
export const PaginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  });

// v0.2.0 cursor pagination — used by GET /api/homelabs and paginated list
// endpoints going forward.
export const CursorPageSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
