import { z } from "zod";

// ─────────────────────────────────────────────
// Lab Metrics (reported by lab-agent to hub-server)
// ─────────────────────────────────────────────

export const CpuMetricsSchema = z.object({
  usagePercent: z.number().min(0).max(100),
  cores: z.number().int().positive(),
  model: z.string(),
});

export type CpuMetrics = z.infer<typeof CpuMetricsSchema>;

export const MemoryMetricsSchema = z.object({
  totalBytes: z.number().int().nonnegative(),
  usedBytes: z.number().int().nonnegative(),
  freeBytes: z.number().int().nonnegative(),
});

export type MemoryMetrics = z.infer<typeof MemoryMetricsSchema>;

export const DiskMetricsSchema = z.object({
  device: z.string(),
  mountPoint: z.string(),
  totalBytes: z.number().int().nonnegative(),
  usedBytes: z.number().int().nonnegative(),
  freeBytes: z.number().int().nonnegative(),
});

export type DiskMetrics = z.infer<typeof DiskMetricsSchema>;

export const LabMetricsSchema = z.object({
  labId: z.string().uuid(),
  timestamp: z.string().datetime(),
  cpu: CpuMetricsSchema,
  memory: MemoryMetricsSchema,
  disks: z.array(DiskMetricsSchema),
  uptimeSeconds: z.number().nonnegative(),
});

export type LabMetrics = z.infer<typeof LabMetricsSchema>;
