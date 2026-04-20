import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Loader2 } from "lucide-react";
import type { MetricsRangeResponse } from "@overwatch/shared-types";
import type { TimeRange } from "./TimeRangeSelector.tsx";

interface Props {
  data: MetricsRangeResponse | undefined;
  range: TimeRange;
  isLoading: boolean;
  error: unknown;
}

const tooltipStyle = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 6,
  fontSize: 11,
  color: "#94a3b8",
};

function formatAxisTime(range: TimeRange): (ts: string) => string {
  // 1h shows HH:MM, 24h shows HH:00, 7d shows day label.
  if (range === "7d") {
    return (ts) => new Date(ts).toLocaleDateString(undefined, { weekday: "short" });
  }
  return (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatPct(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
}

function Chart({
  title,
  data,
  color,
  tickFmt,
  dataKey,
}: {
  title: string;
  data: Array<{ ts: string; v: number }>;
  color: string;
  tickFmt: (ts: string) => string;
  dataKey: string;
}) {
  return (
    <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-4">
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-gray-500">{title}</span>
      </div>
      <div style={{ width: "100%", height: 160 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ts"
              tickFormatter={tickFmt}
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
              minTickGap={30}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
              tickFormatter={(v) => `${v}%`}
              width={36}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(l) => new Date(String(l)).toLocaleString()}
              formatter={(v: unknown) => [formatPct(v), dataKey]}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DiskChart({ data, tickFmt }: { data: MetricsRangeResponse; tickFmt: (ts: string) => string }) {
  // Collect all mount points observed across the window.
  const mounts = useMemo(() => {
    const set = new Set<string>();
    for (const p of data.points) for (const m of Object.keys(p.diskUsedPercent)) set.add(m);
    return Array.from(set).sort();
  }, [data.points]);

  const rows = useMemo(
    () =>
      data.points.map((p) => {
        const row: Record<string, number | string> = { ts: p.timestamp };
        for (const m of mounts) row[m] = p.diskUsedPercent[m] ?? 0;
        return row;
      }),
    [data.points, mounts]
  );

  if (mounts.length === 0) return null;

  const colors = ["#f59e0b", "#a855f7", "#10b981", "#ec4899", "#06b6d4"];

  return (
    <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-4">
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-gray-500">Disk %</span>
      </div>
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ts"
              tickFormatter={tickFmt}
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
              minTickGap={30}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
              tickFormatter={(v) => `${v}%`}
              width={36}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(l) => new Date(String(l)).toLocaleString()}
              formatter={(v: unknown, name: unknown) => [formatPct(v), String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: "#64748b" }} />
            {mounts.map((m, i) => (
              <Line
                key={m}
                type="monotone"
                dataKey={m}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function HistoricalCharts({ data, range, isLoading, error }: Props) {
  const tickFmt = formatAxisTime(range);

  if (isLoading) {
    return (
      <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-10 text-center">
        <div className="flex items-center justify-center gap-2 text-gray-500 text-sm font-mono">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading history…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#060d1a] border border-red-900/60 rounded-xl p-6 text-sm text-red-400 font-mono">
        Failed to load history: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  if (!data || data.points.length === 0) {
    return (
      <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-10 text-center">
        <p className="text-xs text-gray-600 font-mono">No metrics recorded in this window yet.</p>
      </div>
    );
  }

  const cpuSeries = data.points.map((p) => ({ ts: p.timestamp, v: p.cpuPercent }));
  const memSeries = data.points.map((p) => ({ ts: p.timestamp, v: p.memActivePercent }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Chart title="CPU %" data={cpuSeries} color="#06b6d4" tickFmt={tickFmt} dataKey="CPU" />
        <Chart title="Memory %" data={memSeries} color="#a855f7" tickFmt={tickFmt} dataKey="MEM" />
      </div>
      <DiskChart data={data} tickFmt={tickFmt} />
    </div>
  );
}
