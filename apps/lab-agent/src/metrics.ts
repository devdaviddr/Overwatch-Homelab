import si from "systeminformation";
import type {
  CpuMetrics,
  MemoryMetrics,
  DiskMetrics,
  NetworkMetrics,
  OsInfo,
  LabMetrics,
} from "@overwatch/shared-types";

export async function collectMetrics(labId: string): Promise<LabMetrics> {
  const [cpuInfo, load, mem, fsSizes, osInfo, temp, nets, uptime] =
    await Promise.all([
      si.cpu(),
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.osInfo(),
      si.cpuTemperature(),
      si.networkInterfaces(),
      si.time(),
    ]);

  const cpu: CpuMetrics = {
    manufacturer: cpuInfo.manufacturer,
    brand: cpuInfo.brand,
    cores: cpuInfo.cores,
    physicalCores: cpuInfo.physicalCores,
    speedGHz: cpuInfo.speed,
    usagePercent: parseFloat(load.currentLoad.toFixed(2)),
    temperatureCelsius: temp.main ?? null,
  };

  const memory: MemoryMetrics = {
    totalBytes: mem.total,
    usedBytes: mem.used,
    freeBytes: mem.free,
    availableBytes: mem.available,
    swapTotalBytes: mem.swaptotal,
    swapUsedBytes: Math.round(mem.swapused),
  };

  const disks: DiskMetrics[] = fsSizes
    .filter((fs) => fs.size > 0)
    .map((fs) => ({
      fs: fs.fs,
      type: fs.type,
      mountPoint: fs.mount,
      totalBytes: fs.size,
      usedBytes: fs.used,
      availableBytes: fs.available,
      usePercent: parseFloat(fs.use.toFixed(2)),
    }));

  const ifaceList = Array.isArray(nets) ? nets : [nets];
  const network: NetworkMetrics[] = ifaceList
    .filter((n) => !n.internal)
    .map((n) => ({
      iface: n.iface,
      ip4: n.ip4 ?? "",
      mac: n.mac ?? "",
      operstate: n.operstate ?? "unknown",
      speedMbps: n.speed ?? null,
    }));

  const os: OsInfo = {
    platform: osInfo.platform,
    distro: osInfo.distro,
    release: osInfo.release,
    arch: osInfo.arch,
    hostname: osInfo.hostname,
  };

  return {
    labId,
    timestamp: new Date().toISOString(),
    uptimeSeconds: uptime.uptime ?? 0,
    os,
    cpu,
    memory,
    disks,
    network,
  };
}
