import { useQuery } from "@tanstack/react-query";
import { Cpu, MemoryStick, HardDrive } from "lucide-react";
import { apiFetch } from "../lib/api.ts";
import type { MetricsRangeResponse, LabMetrics } from "@overwatch/shared-types";

interface Props {
  token: string | null;
  labId: string;
  liveMetrics: LabMetrics | null;
}

function fetchRange(token: string | null, labId: string, hours: number, resolution: "5m" | "1h") {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  const qs = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    resolution,
  });
  return apiFetch(`/api/homelabs/${labId}/metrics?${qs}`, { token }).then(
    (res) => res.data as MetricsRangeResponse
  );
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function peak(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

function Card({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-4 flex items-start gap-3">
      <div className="h-9 w-9 rounded-md bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-gray-500">{label}</div>
        <div className="text-lg font-mono tabular-nums text-gray-100 mt-0.5">{value}</div>
        <div className="text-[11px] font-mono text-gray-600 mt-0.5 truncate">{sub}</div>
      </div>
    </div>
  );
}

export function SummaryCards({ token, labId, liveMetrics }: Props) {
  const { data: hour } = useQuery({
    queryKey: ["metrics-summary", labId, "1h"],
    queryFn: () => fetchRange(token, labId, 1, "5m"),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const { data: day } = useQuery({
    queryKey: ["metrics-summary", labId, "24h"],
    queryFn: () => fetchRange(token, labId, 24, "1h"),
    enabled: !!token,
    refetchInterval: 5 * 60_000,
  });

  const avgCpu1h = hour ? avg(hour.points.map((p) => p.cpuPercent)) : 0;
  const peakMem24h = day ? peak(day.points.map((p) => p.memActivePercent)) : 0;

  // Current disk used % — use the highest mount-point % from live metrics if
  // available, otherwise the last history point.
  let currentDiskPct = 0;
  let currentDiskLabel = "";
  if (liveMetrics && liveMetrics.disks.length > 0) {
    const worst = liveMetrics.disks.reduce((m, d) => (d.usePercent > m.usePercent ? d : m));
    currentDiskPct = worst.usePercent;
    currentDiskLabel = worst.mountPoint;
  } else if (day && day.points.length > 0) {
    const last = day.points[day.points.length - 1];
    let worst: { mount: string; pct: number } = { mount: "—", pct: 0 };
    for (const [mount, pct] of Object.entries(last.diskUsedPercent)) {
      if (pct > worst.pct) worst = { mount, pct };
    }
    currentDiskPct = worst.pct;
    currentDiskLabel = worst.mount;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
      <Card
        icon={<Cpu className="h-4 w-4" />}
        label="Avg CPU (1h)"
        value={`${avgCpu1h.toFixed(1)}%`}
        sub={hour ? `${hour.points.length} samples` : "loading…"}
      />
      <Card
        icon={<MemoryStick className="h-4 w-4" />}
        label="Peak Memory (24h)"
        value={`${peakMem24h.toFixed(1)}%`}
        sub={day ? `${day.points.length} samples` : "loading…"}
      />
      <Card
        icon={<HardDrive className="h-4 w-4" />}
        label="Disk Used"
        value={`${currentDiskPct.toFixed(1)}%`}
        sub={currentDiskLabel || "—"}
      />
    </div>
  );
}
