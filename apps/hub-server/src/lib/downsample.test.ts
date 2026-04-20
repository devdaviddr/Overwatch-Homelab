import { describe, it, expect } from "vitest";
import { bucketize, RESOLUTION_MS, memPct, diskPctMap, type RawSnapshot } from "./downsample.js";

function snap(
  ts: string,
  cpu: number,
  memActive: number,
  memTotal: number,
  disks: Array<{ mountPoint: string; usedBytes: number; totalBytes: number }> = []
): RawSnapshot {
  return {
    recordedAt: new Date(ts),
    cpuPercent: cpu,
    memActiveBytes: BigInt(memActive),
    memTotalBytes: BigInt(memTotal),
    diskSnapshots: disks,
  };
}

describe("bucketize / downsampling", () => {
  it("returns raw points unchanged for resolution=raw", () => {
    const rows = [
      snap("2026-04-01T10:00:00Z", 30, 100, 200),
      snap("2026-04-01T10:00:10Z", 40, 150, 200),
    ];
    const out = bucketize(rows, RESOLUTION_MS.raw);
    expect(out).toHaveLength(2);
    expect(out[0].cpuPercent).toBe(30);
    expect(out[1].cpuPercent).toBe(40);
    expect(out[0].memActivePercent).toBe(50);
    expect(out[1].memActivePercent).toBe(75);
  });

  it("averages within each 5m bucket", () => {
    const rows = [
      // bucket A (10:00:00)
      snap("2026-04-01T10:00:10Z", 20, 100, 200),
      snap("2026-04-01T10:02:00Z", 40, 100, 200),
      // bucket B (10:05:00)
      snap("2026-04-01T10:06:00Z", 80, 150, 200),
    ];
    const out = bucketize(rows, RESOLUTION_MS["5m"]);
    expect(out).toHaveLength(2);
    expect(out[0].cpuPercent).toBe(30);
    expect(out[1].cpuPercent).toBe(80);
    expect(out[0].memActivePercent).toBe(50);
    expect(out[1].memActivePercent).toBe(75);
  });

  it("merges disk mounts and averages per mount", () => {
    const rows = [
      snap("2026-04-01T10:00:00Z", 10, 0, 1, [
        { mountPoint: "/", usedBytes: 50, totalBytes: 100 },
        { mountPoint: "/data", usedBytes: 20, totalBytes: 100 },
      ]),
      snap("2026-04-01T10:01:00Z", 10, 0, 1, [
        { mountPoint: "/", usedBytes: 70, totalBytes: 100 },
        { mountPoint: "/data", usedBytes: 40, totalBytes: 100 },
      ]),
    ];
    const out = bucketize(rows, RESOLUTION_MS["5m"]);
    expect(out).toHaveLength(1);
    expect(out[0].diskUsedPercent["/"]).toBe(60);
    expect(out[0].diskUsedPercent["/data"]).toBe(30);
  });

  it("produces buckets aligned to the resolution boundary", () => {
    const rows = [snap("2026-04-01T10:07:30Z", 50, 0, 1)];
    const out = bucketize(rows, RESOLUTION_MS["5m"]);
    expect(out[0].timestamp).toBe("2026-04-01T10:05:00.000Z");
  });
});

describe("memPct / diskPctMap helpers", () => {
  it("memPct returns 0 when totalBytes is zero", () => {
    expect(memPct({ memTotalBytes: 0n, memActiveBytes: 100n })).toBe(0);
  });

  it("diskPctMap skips mounts with zero total", () => {
    const out = diskPctMap({
      diskSnapshots: [
        { mountPoint: "/", usedBytes: 50, totalBytes: 100 },
        { mountPoint: "/empty", usedBytes: 0, totalBytes: 0 },
      ],
    });
    expect(out).toEqual({ "/": 50 });
  });
});
