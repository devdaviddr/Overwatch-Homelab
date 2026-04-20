import type { Server as SocketServer } from "socket.io";
import type { LabMetrics, AlertThresholds, AlertMetric } from "@overwatch/shared-types";
import { prisma } from "./prisma.js";

interface DiskSnapshot {
  mountPoint: string;
  usedBytes: number;
  totalBytes: number;
}

function diskSnapshotsFrom(m: LabMetrics): DiskSnapshot[] {
  return m.disks.map((d) => ({
    mountPoint: d.mountPoint,
    usedBytes: d.usedBytes,
    totalBytes: d.totalBytes,
  }));
}

function maxDiskUsedPercent(m: LabMetrics): number {
  return m.disks.reduce((max, d) => Math.max(max, d.usePercent), 0);
}

function memActivePercent(m: LabMetrics): number {
  if (!m.memory.totalBytes) return 0;
  return (m.memory.activeBytes / m.memory.totalBytes) * 100;
}

export async function persistMetricSnapshot(m: LabMetrics): Promise<void> {
  await prisma.metricSnapshot.create({
    data: {
      labId: m.labId,
      recordedAt: new Date(m.timestamp),
      cpuPercent: m.cpu.usagePercent,
      memTotalBytes: BigInt(m.memory.totalBytes),
      memActiveBytes: BigInt(m.memory.activeBytes),
      diskSnapshots: diskSnapshotsFrom(m) as unknown as object,
      rawPayload: m as unknown as object,
    },
  });
}

// ── Alert evaluator ─────────────────────────────────────────────────────────
// After each snapshot is persisted, we ask: for each metric with a threshold,
// have the last N snapshots ALL breached? If yes and no active alert exists,
// fire a new one. If the latest snapshot is under-threshold, resolve any
// active alert for that metric.

const METRIC_VALUE: Record<AlertMetric, (m: LabMetrics) => number> = {
  cpu: (m) => m.cpu.usagePercent,
  memory: (m) => memActivePercent(m),
  disk: (m) => maxDiskUsedPercent(m),
};

const METRIC_THRESHOLD_KEY: Record<AlertMetric, keyof AlertThresholds> = {
  cpu: "cpuPercent",
  memory: "memPercent",
  disk: "diskPercent",
};

export async function evaluateAlerts(m: LabMetrics, io?: SocketServer): Promise<void> {
  const lab = await prisma.homeLab.findUnique({
    where: { id: m.labId },
    select: { alertThresholds: true },
  });
  if (!lab?.alertThresholds) return;

  const thresholds = lab.alertThresholds as unknown as AlertThresholds;
  const n = thresholds.consecutiveBreaches;

  for (const metric of ["cpu", "memory", "disk"] as AlertMetric[]) {
    const value = METRIC_VALUE[metric](m);
    const threshold = thresholds[METRIC_THRESHOLD_KEY[metric]];

    const active = await prisma.alert.findFirst({
      where: { labId: m.labId, metric, resolvedAt: null },
      orderBy: { firedAt: "desc" },
    });

    if (value >= threshold) {
      // Still breaching — either update peakValue on active alert or check fire.
      if (active) {
        if (value > active.peakValue) {
          await prisma.alert.update({ where: { id: active.id }, data: { peakValue: value } });
        }
        continue;
      }

      // Check the last N snapshots — fire only if all breach.
      const recent = await prisma.metricSnapshot.findMany({
        where: { labId: m.labId },
        orderBy: { recordedAt: "desc" },
        take: n,
        select: { rawPayload: true, cpuPercent: true, memActiveBytes: true, memTotalBytes: true, diskSnapshots: true },
      });
      if (recent.length < n) continue;

      const allBreach = recent.every((snap) => {
        if (metric === "cpu") return snap.cpuPercent >= threshold;
        if (metric === "memory") {
          const total = Number(snap.memTotalBytes);
          if (!total) return false;
          return (Number(snap.memActiveBytes) / total) * 100 >= threshold;
        }
        // disk — use max across snapshots
        const ds = snap.diskSnapshots as unknown as DiskSnapshot[];
        const max = ds.reduce((mx, d) => {
          const pct = d.totalBytes ? (d.usedBytes / d.totalBytes) * 100 : 0;
          return pct > mx ? pct : mx;
        }, 0);
        return max >= threshold;
      });

      if (allBreach) {
        const alert = await prisma.alert.create({
          data: { labId: m.labId, metric, threshold, peakValue: value },
        });
        console.log(`[Alerts] Fired ${metric} alert for lab=${m.labId} value=${value.toFixed(1)}`);
        io?.to(`lab:${m.labId}`).emit("lab:alert", alert);
      }
    } else {
      // Not breaching — resolve any active alert for this metric.
      if (active) {
        const resolved = await prisma.alert.update({
          where: { id: active.id },
          data: { resolvedAt: new Date() },
        });
        console.log(`[Alerts] Resolved ${metric} alert for lab=${m.labId}`);
        io?.to(`lab:${m.labId}`).emit("lab:alert-resolved", resolved);
      }
    }
  }
}

// ── Retention pruner ────────────────────────────────────────────────────────
// Every 6 h, delete snapshots older than each lab's retentionDays.
// Batches of 1000 so large backfills don't block other writes.

const PRUNER_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BATCH_SIZE = 1000;

export async function pruneOnce(): Promise<void> {
  const labs = await prisma.homeLab.findMany({ select: { id: true, retentionDays: true } });
  for (const lab of labs) {
    const cutoff = new Date(Date.now() - lab.retentionDays * 24 * 60 * 60 * 1000);
    let deleted = 0;
    for (;;) {
      const victims = await prisma.metricSnapshot.findMany({
        where: { labId: lab.id, recordedAt: { lt: cutoff } },
        orderBy: { recordedAt: "asc" },
        take: BATCH_SIZE,
        select: { id: true },
      });
      if (victims.length === 0) break;
      const result = await prisma.metricSnapshot.deleteMany({
        where: { id: { in: victims.map((v) => v.id) } },
      });
      deleted += result.count;
      if (victims.length < BATCH_SIZE) break;
    }
    if (deleted > 0) {
      console.log(`[Retention] Pruned ${deleted} snapshots for lab=${lab.id} (retention=${lab.retentionDays}d)`);
    }
  }
}

export function startRetentionPruner(): NodeJS.Timeout {
  // Run once at startup (non-blocking), then every 6 h.
  pruneOnce().catch((err) => console.error("[Retention] initial run failed:", err));
  const handle = setInterval(() => {
    pruneOnce().catch((err) => console.error("[Retention] scheduled run failed:", err));
  }, PRUNER_INTERVAL_MS);
  handle.unref();
  return handle;
}
