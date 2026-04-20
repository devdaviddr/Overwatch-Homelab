import type { MetricPoint } from "@overwatch/shared-types";

export const RESOLUTION_MS: Record<"raw" | "1m" | "5m" | "1h", number> = {
  raw: 0,
  "1m": 60_000,
  "5m": 5 * 60_000,
  "1h": 60 * 60_000,
};

export interface RawSnapshot {
  recordedAt: Date;
  cpuPercent: number;
  memTotalBytes: bigint;
  memActiveBytes: bigint;
  diskSnapshots: unknown;
}

export function memPct(r: { memTotalBytes: bigint; memActiveBytes: bigint }): number {
  const total = Number(r.memTotalBytes);
  if (!total) return 0;
  return (Number(r.memActiveBytes) / total) * 100;
}

export function diskPctMap(r: { diskSnapshots: unknown }): Record<string, number> {
  const arr = (r.diskSnapshots ?? []) as Array<{ mountPoint: string; usedBytes: number; totalBytes: number }>;
  const out: Record<string, number> = {};
  for (const d of arr) {
    if (!d.totalBytes) continue;
    out[d.mountPoint] = (d.usedBytes / d.totalBytes) * 100;
  }
  return out;
}

export function bucketize(rows: RawSnapshot[], bucketMs: number): MetricPoint[] {
  if (bucketMs === 0) {
    return rows.map((r) => ({
      timestamp: r.recordedAt.toISOString(),
      cpuPercent: r.cpuPercent,
      memActivePercent: memPct(r),
      diskUsedPercent: diskPctMap(r),
    }));
  }

  type Acc = {
    bucketStart: number;
    cpuSum: number;
    memSum: number;
    diskSums: Record<string, number>;
    diskCounts: Record<string, number>;
    count: number;
  };
  const buckets = new Map<number, Acc>();

  for (const r of rows) {
    const t = r.recordedAt.getTime();
    const key = Math.floor(t / bucketMs) * bucketMs;
    let acc = buckets.get(key);
    if (!acc) {
      acc = { bucketStart: key, cpuSum: 0, memSum: 0, diskSums: {}, diskCounts: {}, count: 0 };
      buckets.set(key, acc);
    }
    acc.cpuSum += r.cpuPercent;
    acc.memSum += memPct(r);
    const disks = diskPctMap(r);
    for (const [mount, pct] of Object.entries(disks)) {
      acc.diskSums[mount] = (acc.diskSums[mount] ?? 0) + pct;
      acc.diskCounts[mount] = (acc.diskCounts[mount] ?? 0) + 1;
    }
    acc.count += 1;
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.bucketStart - b.bucketStart)
    .map((acc) => {
      const diskUsedPercent: Record<string, number> = {};
      for (const mount of Object.keys(acc.diskSums)) {
        diskUsedPercent[mount] = acc.diskSums[mount] / acc.diskCounts[mount];
      }
      return {
        timestamp: new Date(acc.bucketStart).toISOString(),
        cpuPercent: acc.cpuSum / acc.count,
        memActivePercent: acc.memSum / acc.count,
        diskUsedPercent,
      };
    });
}
