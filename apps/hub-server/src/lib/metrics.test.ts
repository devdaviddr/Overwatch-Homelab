import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.mock is hoisted, so the mock factory has to set up its own vi.fn() refs
// that the test body reaches via the mocked module.
const {
  homeLabFindUnique,
  snapshotFindMany,
  alertFindFirst,
  alertCreate,
  alertUpdate,
} = vi.hoisted(() => ({
  homeLabFindUnique: vi.fn(),
  snapshotFindMany: vi.fn(),
  alertFindFirst: vi.fn(),
  alertCreate: vi.fn(),
  alertUpdate: vi.fn(),
}));

vi.mock("./prisma.js", () => ({
  prisma: {
    homeLab: { findUnique: homeLabFindUnique },
    metricSnapshot: { findMany: snapshotFindMany },
    alert: {
      findFirst: alertFindFirst,
      create: alertCreate,
      update: alertUpdate,
    },
  },
}));

import { evaluateAlerts } from "./metrics.js";
import type { LabMetrics } from "@overwatch/shared-types";

const LAB_ID = "11111111-1111-1111-1111-111111111111";

function buildMetrics(cpu: number, memActive = 0, memTotal = 100): LabMetrics {
  return {
    labId: LAB_ID,
    timestamp: new Date().toISOString(),
    uptimeSeconds: 0,
    os: { platform: "linux", distro: "test", release: "1", arch: "x64", hostname: "h" },
    cpu: {
      manufacturer: "x",
      brand: "y",
      cores: 1,
      physicalCores: 1,
      speedGHz: 1,
      usagePercent: cpu,
      temperatureCelsius: null,
    },
    memory: {
      totalBytes: memTotal,
      usedBytes: memActive,
      activeBytes: memActive,
      freeBytes: 0,
      availableBytes: 0,
      swapTotalBytes: 0,
      swapUsedBytes: 0,
    },
    disks: [],
    network: [],
  };
}

function breachingSnapshot(cpu: number) {
  return {
    cpuPercent: cpu,
    memActiveBytes: 0n,
    memTotalBytes: 100n,
    diskSnapshots: [],
  };
}

describe("evaluateAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when the lab has no thresholds configured", async () => {
    homeLabFindUnique.mockResolvedValue({ alertThresholds: null });
    await evaluateAlerts(buildMetrics(99));
    expect(alertCreate).not.toHaveBeenCalled();
    expect(alertFindFirst).not.toHaveBeenCalled();
  });

  it("fires a CPU alert after N consecutive breaches and no pre-existing active alert", async () => {
    homeLabFindUnique.mockResolvedValue({
      alertThresholds: { cpuPercent: 80, memPercent: 100, diskPercent: 100, consecutiveBreaches: 3 },
    });
    alertFindFirst.mockResolvedValue(null); // no active alert
    snapshotFindMany.mockResolvedValue([
      breachingSnapshot(95),
      breachingSnapshot(90),
      breachingSnapshot(85),
    ]);
    alertCreate.mockResolvedValue({ id: "a", labId: LAB_ID, metric: "cpu", peakValue: 95 });

    await evaluateAlerts(buildMetrics(95));

    expect(alertCreate).toHaveBeenCalledTimes(1);
    expect(alertCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metric: "cpu", threshold: 80, peakValue: 95 }),
      })
    );
  });

  it("does not fire when fewer than N snapshots have been recorded", async () => {
    homeLabFindUnique.mockResolvedValue({
      alertThresholds: { cpuPercent: 80, memPercent: 100, diskPercent: 100, consecutiveBreaches: 3 },
    });
    alertFindFirst.mockResolvedValue(null);
    snapshotFindMany.mockResolvedValue([breachingSnapshot(95)]); // only one sample

    await evaluateAlerts(buildMetrics(95));
    expect(alertCreate).not.toHaveBeenCalled();
  });

  it("updates peakValue when an active alert is still breaching and the new value is higher", async () => {
    homeLabFindUnique.mockResolvedValue({
      alertThresholds: { cpuPercent: 80, memPercent: 100, diskPercent: 100, consecutiveBreaches: 3 },
    });
    alertFindFirst.mockResolvedValue({ id: "a", peakValue: 85, resolvedAt: null });

    await evaluateAlerts(buildMetrics(92));

    expect(alertUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "a" },
        data: { peakValue: 92 },
      })
    );
    expect(alertCreate).not.toHaveBeenCalled();
  });

  it("resolves an active alert when the latest value is under threshold", async () => {
    homeLabFindUnique.mockResolvedValue({
      alertThresholds: { cpuPercent: 80, memPercent: 100, diskPercent: 100, consecutiveBreaches: 3 },
    });
    alertFindFirst.mockResolvedValue({ id: "a", peakValue: 95, resolvedAt: null });
    alertUpdate.mockResolvedValue({ id: "a", resolvedAt: new Date() });

    await evaluateAlerts(buildMetrics(50));

    expect(alertUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "a" },
        data: { resolvedAt: expect.any(Date) },
      })
    );
  });

  it("does not update peakValue when the new value is lower than current peak", async () => {
    homeLabFindUnique.mockResolvedValue({
      alertThresholds: { cpuPercent: 80, memPercent: 100, diskPercent: 100, consecutiveBreaches: 3 },
    });
    alertFindFirst.mockResolvedValue({ id: "a", peakValue: 95, resolvedAt: null });

    await evaluateAlerts(buildMetrics(88));

    // peak unchanged — no update call for peakValue
    const peakUpdates = alertUpdate.mock.calls.filter(
      (c) => (c[0] as { data?: { peakValue?: unknown } })?.data?.peakValue !== undefined
    );
    expect(peakUpdates).toHaveLength(0);
  });
});
