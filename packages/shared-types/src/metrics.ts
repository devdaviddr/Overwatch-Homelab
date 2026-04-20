import { z } from "zod";

// ─────────────────────────────────────────────
// Lab Metrics (reported by lab-agent to hub-server)
// Collected via the `systeminformation` library.
// ─────────────────────────────────────────────

export const CpuMetricsSchema = z.object({
  manufacturer: z.string(),
  brand: z.string(),
  cores: z.number().int().positive(),           // logical cores
  physicalCores: z.number().int().positive(),
  speedGHz: z.number().nonnegative(),           // base clock
  usagePercent: z.number().min(0).max(100),     // current overall load
  temperatureCelsius: z.number().nullable(),    // null when unsupported (e.g. macOS)
});

export type CpuMetrics = z.infer<typeof CpuMetricsSchema>;

export const MemoryMetricsSchema = z.object({
  totalBytes: z.number().int().nonnegative(),
  usedBytes: z.number().int().nonnegative(),    // total - free (includes cached/inactive on macOS)
  activeBytes: z.number().int().nonnegative(),  // pages actively in use by processes
  freeBytes: z.number().int().nonnegative(),
  availableBytes: z.number().int().nonnegative(), // free + reclaimable cache
  swapTotalBytes: z.number().int().nonnegative(),
  swapUsedBytes: z.number().int().nonnegative(),
});

export type MemoryMetrics = z.infer<typeof MemoryMetricsSchema>;

export const DiskMetricsSchema = z.object({
  fs: z.string(),                               // device path, e.g. /dev/sda1
  type: z.string(),                             // filesystem type, e.g. ext4, APFS
  mountPoint: z.string(),
  totalBytes: z.number().int().nonnegative(),
  usedBytes: z.number().int().nonnegative(),
  availableBytes: z.number().int().nonnegative(),
  usePercent: z.number().min(0).max(100),
});

export type DiskMetrics = z.infer<typeof DiskMetricsSchema>;

export const NetworkMetricsSchema = z.object({
  iface: z.string(),
  ip4: z.string(),
  mac: z.string(),
  operstate: z.string(),                        // "up" | "down" | "unknown"
  speedMbps: z.number().nullable(),
});

export type NetworkMetrics = z.infer<typeof NetworkMetricsSchema>;

export const OsInfoSchema = z.object({
  platform: z.string(),                         // "linux" | "darwin" | "win32"
  distro: z.string(),                           // e.g. "Ubuntu", "macOS"
  release: z.string(),
  arch: z.string(),                             // e.g. "x64", "arm64"
  hostname: z.string(),
});

export type OsInfo = z.infer<typeof OsInfoSchema>;

export const LabMetricsSchema = z.object({
  labId: z.string().uuid(),
  timestamp: z.string().datetime(),
  uptimeSeconds: z.number().nonnegative(),
  os: OsInfoSchema,
  cpu: CpuMetricsSchema,
  memory: MemoryMetricsSchema,
  disks: z.array(DiskMetricsSchema),
  network: z.array(NetworkMetricsSchema),
});

export type LabMetrics = z.infer<typeof LabMetricsSchema>;

// ─────────────────────────────────────────────
// Historical metrics (v0.2.0)
// Response shape for GET /api/homelabs/:id/metrics — one point per
// time bucket after server-side averaging.
// ─────────────────────────────────────────────

export const MetricPointSchema = z.object({
  timestamp: z.string().datetime(),
  cpuPercent: z.number().min(0).max(100),
  memActivePercent: z.number().min(0).max(100),
  diskUsedPercent: z.record(z.string(), z.number().min(0).max(100)),
});

export type MetricPoint = z.infer<typeof MetricPointSchema>;

export const MetricsRangeResponseSchema = z.object({
  labId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  resolution: z.enum(["raw", "1m", "5m", "1h"]),
  points: z.array(MetricPointSchema),
});

export type MetricsRangeResponse = z.infer<typeof MetricsRangeResponseSchema>;

export const MetricsRangeQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  resolution: z.enum(["raw", "1m", "5m", "1h"]).optional().default("5m"),
});

export type MetricsRangeQuery = z.infer<typeof MetricsRangeQuerySchema>;

// ─────────────────────────────────────────────
// Alerts (v0.2.0)
// ─────────────────────────────────────────────

export const AlertMetricSchema = z.enum(["cpu", "memory", "disk"]);
export type AlertMetric = z.infer<typeof AlertMetricSchema>;

export const AlertSchema = z.object({
  id: z.string().uuid(),
  labId: z.string().uuid(),
  metric: AlertMetricSchema,
  threshold: z.number(),
  peakValue: z.number(),
  firedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  acknowledgedAt: z.string().datetime().nullable(),
});

export type Alert = z.infer<typeof AlertSchema>;
