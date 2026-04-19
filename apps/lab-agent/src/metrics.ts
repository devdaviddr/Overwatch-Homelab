import os from "os";
import type { CpuMetrics, MemoryMetrics, DiskMetrics, LabMetrics } from "@overwatch/shared-types";

/**
 * Collect basic system metrics using Node.js built-in os module.
 * For production use, consider replacing disk collection with
 * a native library like `systeminformation`.
 */
export function collectMetrics(labId: string): LabMetrics {
  const cpuInfo = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();

  const cpu: CpuMetrics = {
    // Calculate approximate CPU usage from idle vs total times
    usagePercent: computeCpuUsagePercent(cpuInfo),
    cores: cpuInfo.length,
    model: cpuInfo[0]?.model ?? "Unknown",
  };

  const memory: MemoryMetrics = {
    totalBytes: totalMemory,
    usedBytes: totalMemory - freeMemory,
    freeBytes: freeMemory,
  };

  // Disk metrics require a native library like `systeminformation`.
  // This placeholder returns empty disk data until proper integration is added.
  const disks: DiskMetrics[] = [];

  return {
    labId,
    timestamp: new Date().toISOString(),
    cpu,
    memory,
    disks,
    uptimeSeconds: os.uptime(),
  };
}

function computeCpuUsagePercent(cpus: os.CpuInfo[]): number {
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times) as (keyof os.CpuInfo["times"])[]) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;

  return parseFloat(((1 - idle / total) * 100).toFixed(2));
}
