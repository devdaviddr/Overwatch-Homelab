import { Cpu, MemoryStick, HardDrive, Network, Thermometer, Wifi, WifiOff } from "lucide-react";
import type { LabMetrics } from "@overwatch/shared-types";

interface Props {
  metrics: LabMetrics;
  lastUpdated: Date | null;
  connected: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function UsageBar({ pct, label }: { pct: number; label: string }) {
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-brand-500";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function MetricsDashboard({ metrics, lastUpdated, connected }: Props) {
  const { cpu, memory, disks, network, os } = metrics;
  const memUsedPct = memory.totalBytes > 0 ? (memory.usedBytes / memory.totalBytes) * 100 : 0;
  const swapUsedPct = memory.swapTotalBytes > 0 ? (memory.swapUsedBytes / memory.swapTotalBytes) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          Live Metrics
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            connected
              ? "text-green-400 border-green-800 bg-green-950/40"
              : "text-gray-500 border-gray-700 bg-gray-900"
          }`}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? "Live" : "Disconnected"}
          </span>
        </h2>
        {lastUpdated && (
          <span className="text-xs text-gray-500">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* OS info strip */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-gray-400">
          <span className="text-gray-500 text-xs uppercase tracking-wider mr-1">Host</span>
          <span className="text-white font-medium">{os.hostname}</span>
        </span>
        <span className="text-gray-400">
          <span className="text-gray-500 text-xs uppercase tracking-wider mr-1">OS</span>
          <span className="text-white">{os.distro} {os.release}</span>
        </span>
        <span className="text-gray-400">
          <span className="text-gray-500 text-xs uppercase tracking-wider mr-1">Arch</span>
          <span className="text-white">{os.arch}</span>
        </span>
        <span className="text-gray-400">
          <span className="text-gray-500 text-xs uppercase tracking-wider mr-1">Uptime</span>
          <span className="text-white">{formatUptime(metrics.uptimeSeconds)}</span>
        </span>
      </div>

      {/* CPU + Memory row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CPU */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="h-4 w-4 text-brand-400" />
            <span className="font-medium text-white text-sm">CPU</span>
          </div>
          <p className="text-xs text-gray-400 mb-1">{cpu.manufacturer} {cpu.brand}</p>
          <p className="text-xs text-gray-500 mb-3">
            {cpu.physicalCores}C / {cpu.cores}T &nbsp;·&nbsp; {cpu.speedGHz.toFixed(1)} GHz base
          </p>
          <UsageBar pct={cpu.usagePercent} label="Load" />
          {cpu.temperatureCelsius !== null && (
            <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
              <Thermometer className="h-3.5 w-3.5 text-orange-400" />
              <span>{cpu.temperatureCelsius.toFixed(1)} °C</span>
            </div>
          )}
        </div>

        {/* Memory */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MemoryStick className="h-4 w-4 text-brand-400" />
            <span className="font-medium text-white text-sm">Memory</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {formatBytes(memory.usedBytes)} used of {formatBytes(memory.totalBytes)} &nbsp;·&nbsp; {formatBytes(memory.availableBytes)} available
          </p>
          <UsageBar pct={memUsedPct} label="RAM" />
          {memory.swapTotalBytes > 0 && (
            <>
              <div className="mt-3" />
              <UsageBar pct={swapUsedPct} label={`Swap (${formatBytes(memory.swapTotalBytes)})`} />
            </>
          )}
        </div>
      </div>

      {/* Disks */}
      {disks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-300">Filesystems</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {disks.map((disk) => (
              <div key={`${disk.fs}-${disk.mountPoint}`} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-white text-sm font-medium truncate max-w-[60%]">{disk.mountPoint}</span>
                  <span className="text-xs text-gray-500 shrink-0">{disk.type}</span>
                </div>
                <p className="text-xs text-gray-500 truncate mb-2">{disk.fs}</p>
                <UsageBar pct={disk.usePercent} label={`${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Network */}
      {network.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Network className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-300">Network Interfaces</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {network.map((iface) => (
              <div key={iface.iface} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{iface.iface}</p>
                  <p className="text-xs text-gray-400">{iface.ip4 || "—"}</p>
                  <p className="text-xs text-gray-600">{iface.mac}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${
                    iface.operstate === "up"
                      ? "text-green-400 border-green-800 bg-green-950/40"
                      : "text-gray-500 border-gray-700"
                  }`}>
                    {iface.operstate}
                  </span>
                  {iface.speedMbps && (
                    <p className="text-xs text-gray-500 mt-1">{iface.speedMbps} Mbps</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}
