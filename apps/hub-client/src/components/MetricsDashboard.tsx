import { useMemo } from "react";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { Thermometer } from "lucide-react";
import type { LabMetrics } from "@overwatch/shared-types";
import type { MetricsPoint } from "../hooks/useLabMetrics.ts";

interface Props {
  metrics: LabMetrics;
  lastUpdated: Date | null;
  connected: boolean;
  history: MetricsPoint[];
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function metricColor(pct: number): { stroke: string; fill: string; text: string } {
  if (pct >= 90) return { stroke: "#ef4444", fill: "#ef444420", text: "text-red-400" };
  if (pct >= 70) return { stroke: "#f59e0b", fill: "#f59e0b20", text: "text-amber-400" };
  return { stroke: "#06b6d4", fill: "#06b6d420", text: "text-cyan-400" };
}

/* ─── Circular SVG gauge ────────────────────────────────────────────────── */

function CircularGauge({ pct, size = 130 }: { pct: number; size?: number }) {
  const r = (size - 20) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;
  const { stroke, text } = metricColor(pct);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ display: "block" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1f2937"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease", filter: `drop-shadow(0 0 6px ${stroke}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold font-mono tabular-nums ${text}`}>
          {pct.toFixed(0)}
        </span>
        <span className="text-xs text-gray-500 font-mono">%</span>
      </div>
    </div>
  );
}

/* ─── Mini sparkline ─────────────────────────────────────────────────────── */

function Sparkline({
  data,
  dataKey,
  color,
  fill,
}: {
  data: MetricsPoint[];
  dataKey: "cpu" | "mem";
  color: string;
  fill: string;
}) {
  const padded = useMemo(() => {
    if (data.length === 0) return [{ t: 0, cpu: 0, mem: 0 }];
    if (data.length < 3) return [...Array(3 - data.length).fill({ t: 0, cpu: 0, mem: 0 }), ...data];
    return data;
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={80}>
      <AreaChart data={padded} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <YAxis domain={[0, 100]} hide />
        <Tooltip
          contentStyle={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 6,
            fontSize: 11,
            color: "#94a3b8",
          }}
          formatter={(value) => [`${typeof value === "number" ? value : 0}%`, dataKey.toUpperCase()]}
          labelFormatter={() => ""}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${dataKey})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Section heading ────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px flex-1 bg-gray-800" />
      <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-gray-500">{children}</span>
      <div className="h-px flex-1 bg-gray-800" />
    </div>
  );
}

/* ─── Usage bar ──────────────────────────────────────────────────────────── */

function UsageBar({ pct, label, sub }: { pct: number; label: string; sub?: string }) {
  const { stroke } = metricColor(pct);
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-gray-300 truncate max-w-[70%]">{label}</span>
        {sub && <span className="text-[10px] text-gray-600 ml-1 shrink-0">{sub}</span>}
        <span className="text-xs font-mono tabular-nums text-gray-400 ml-2 shrink-0">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, background: stroke, boxShadow: `0 0 6px ${stroke}60` }}
        />
      </div>
    </div>
  );
}

/* ─── Main dashboard ──────────────────────────────────────────────────────── */

export function MetricsDashboard({ metrics, lastUpdated, connected, history }: Props) {
  const { cpu, memory, disks, network, os } = metrics;
  const memPct = memory.totalBytes > 0 ? (memory.activeBytes / memory.totalBytes) * 100 : 0;
  const swapPct = memory.swapTotalBytes > 0 ? (memory.swapUsedBytes / memory.swapTotalBytes) * 100 : 0;
  const cpuColors = metricColor(cpu.usagePercent);
  const memColors = metricColor(memPct);

  return (
    <div className="space-y-6 font-mono">
      {/* ── Status bar ── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 bg-[#060d1a] border border-gray-800/60 rounded-xl text-[11px]">
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-gray-600"}`}
            style={connected ? { boxShadow: "0 0 6px #22c55e" } : {}}
          />
          <span className={connected ? "text-green-400" : "text-gray-500"}>{connected ? "LIVE" : "OFFLINE"}</span>
        </span>
        <span className="text-gray-500">
          <span className="text-gray-600">HOST </span>
          <span className="text-gray-200">{os.hostname}</span>
        </span>
        <span className="text-gray-500">
          <span className="text-gray-600">OS </span>
          <span className="text-gray-200">{os.distro} {os.release}</span>
        </span>
        <span className="text-gray-500">
          <span className="text-gray-600">ARCH </span>
          <span className="text-gray-200">{os.arch}</span>
        </span>
        <span className="text-gray-500">
          <span className="text-gray-600">UPTIME </span>
          <span className="text-gray-200">{formatUptime(metrics.uptimeSeconds)}</span>
        </span>
        {lastUpdated && (
          <span className="ml-auto text-gray-600">
            {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* ── CPU + Memory gauges ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CPU card */}
        <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] tracking-[0.18em] uppercase text-gray-500">CPU</span>
            {cpu.temperatureCelsius !== null && (
              <span className="flex items-center gap-1 text-[10px] text-orange-400">
                <Thermometer className="h-3 w-3" />
                {cpu.temperatureCelsius.toFixed(1)}°C
              </span>
            )}
          </div>
          <div className="flex items-center gap-5">
            <CircularGauge pct={cpu.usagePercent} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 font-sans font-medium leading-tight truncate">
                {cpu.brand || cpu.manufacturer}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 font-mono">
                {cpu.physicalCores}C / {cpu.cores}T
                {cpu.speedGHz > 0 && ` · ${cpu.speedGHz.toFixed(2)} GHz`}
              </p>
              <div className="mt-3">
                <span className="text-[10px] uppercase tracking-widest text-gray-600">Usage trend</span>
                {history.length > 0 ? (
                  <Sparkline data={history} dataKey="cpu" color={cpuColors.stroke} fill={cpuColors.fill} />
                ) : (
                  <div className="h-20 flex items-center justify-center text-[10px] text-gray-700">
                    collecting data…
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Memory card */}
        <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] tracking-[0.18em] uppercase text-gray-500">Memory</span>
            <span className="text-[10px] text-gray-600">{formatBytes(memory.totalBytes)} total</span>
          </div>
          <div className="flex items-center gap-5">
            <CircularGauge pct={memPct} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 font-sans font-medium">
                {formatBytes(memory.activeBytes)}
                <span className="text-gray-600 font-normal"> active</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {formatBytes(memory.availableBytes)} available
                <span className="text-gray-600"> · {formatBytes(memory.totalBytes)} total</span>
              </p>
              {memory.swapTotalBytes > 0 && (
                <p className="text-[10px] text-gray-600 mt-1">
                  Swap {formatBytes(memory.swapUsedBytes)} / {formatBytes(memory.swapTotalBytes)}
                  {" "}({swapPct.toFixed(1)}%)
                </p>
              )}
              <div className="mt-3">
                <span className="text-[10px] uppercase tracking-widest text-gray-600">Usage trend</span>
                {history.length > 0 ? (
                  <Sparkline data={history} dataKey="mem" color={memColors.stroke} fill={memColors.fill} />
                ) : (
                  <div className="h-20 flex items-center justify-center text-[10px] text-gray-700">
                    collecting data…
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filesystems ── */}
      {disks.length > 0 && (
        <div>
          <SectionLabel>Filesystems</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...disks].sort((a, b) => b.usePercent - a.usePercent).map((disk) => (
              <div
                key={`${disk.fs}-${disk.mountPoint}`}
                className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-4"
              >
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-xs font-sans font-medium text-gray-200 truncate max-w-[60%]">
                    {disk.mountPoint}
                  </span>
                  <span className="text-[10px] text-gray-600 shrink-0 ml-1">{disk.type}</span>
                </div>
                <UsageBar
                  pct={disk.usePercent}
                  label={disk.fs.length > 24 ? disk.fs.slice(-24) : disk.fs}
                  sub={`${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Network ── */}
      {network.length > 0 && (
        <div>
          <SectionLabel>Network Interfaces</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {network.map((iface) => (
              <div
                key={iface.iface}
                className="bg-[#060d1a] border border-gray-800/60 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${iface.operstate === "up" ? "bg-green-500" : "bg-gray-600"}`}
                      style={iface.operstate === "up" ? { boxShadow: "0 0 5px #22c55e" } : {}}
                    />
                    <span className="text-xs font-sans font-medium text-gray-200">{iface.iface}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 ml-3.5">
                    {iface.ip4 || "—"}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5 ml-3.5">{iface.mac}</p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border font-mono ${
                      iface.operstate === "up"
                        ? "text-green-400 border-green-900/60 bg-green-950/30"
                        : "text-gray-600 border-gray-800"
                    }`}
                  >
                    {iface.operstate.toUpperCase()}
                  </span>
                  {iface.speedMbps ? (
                    <p className="text-[10px] text-gray-600 mt-1">{iface.speedMbps} Mbps</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

