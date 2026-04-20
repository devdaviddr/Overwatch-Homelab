import { describe, it, expect, beforeEach, vi } from "vitest";

const { homeLabFindMany, snapshotFindMany, snapshotDeleteMany } = vi.hoisted(() => ({
  homeLabFindMany: vi.fn(),
  snapshotFindMany: vi.fn(),
  snapshotDeleteMany: vi.fn(),
}));

vi.mock("./prisma.js", () => ({
  prisma: {
    homeLab: { findMany: homeLabFindMany },
    metricSnapshot: {
      findMany: snapshotFindMany,
      deleteMany: snapshotDeleteMany,
    },
    alert: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { pruneOnce } from "./metrics.js";

function rowsOfIds(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `id-${i}` }));
}

describe("retention pruner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses each lab's retentionDays to derive the cutoff", async () => {
    homeLabFindMany.mockResolvedValue([
      { id: "labA", retentionDays: 30 },
      { id: "labB", retentionDays: 7 },
    ]);
    snapshotFindMany.mockResolvedValue([]);

    const before = Date.now();
    await pruneOnce();
    const after = Date.now();

    // Two labs → one findMany call each to look for victims.
    const calls = snapshotFindMany.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);

    const [aCall, bCall] = calls;
    expect(aCall.where.labId).toBe("labA");
    expect(bCall.where.labId).toBe("labB");

    // Cutoffs should be retentionDays ago within a small slack window.
    const expectedA = before - 30 * 24 * 60 * 60 * 1000;
    const expectedB = before - 7 * 24 * 60 * 60 * 1000;
    const aCutoff = (aCall.where.recordedAt.lt as Date).getTime();
    const bCutoff = (bCall.where.recordedAt.lt as Date).getTime();
    expect(aCutoff).toBeGreaterThanOrEqual(expectedA - 50);
    expect(aCutoff).toBeLessThanOrEqual(after - 30 * 24 * 60 * 60 * 1000 + 50);
    expect(bCutoff).toBeGreaterThanOrEqual(expectedB - 50);
    expect(bCutoff).toBeLessThanOrEqual(after - 7 * 24 * 60 * 60 * 1000 + 50);
  });

  it("deletes in batches of 1000 and continues until a partial batch is returned", async () => {
    homeLabFindMany.mockResolvedValue([{ id: "labA", retentionDays: 30 }]);
    snapshotFindMany
      .mockResolvedValueOnce(rowsOfIds(1000))
      .mockResolvedValueOnce(rowsOfIds(1000))
      .mockResolvedValueOnce(rowsOfIds(250)); // partial — stop after this delete
    snapshotDeleteMany
      .mockResolvedValueOnce({ count: 1000 })
      .mockResolvedValueOnce({ count: 1000 })
      .mockResolvedValueOnce({ count: 250 });

    await pruneOnce();

    expect(snapshotFindMany).toHaveBeenCalledTimes(3);
    expect(snapshotDeleteMany).toHaveBeenCalledTimes(3);
    // First delete must target exactly 1000 ids.
    const firstDelete = snapshotDeleteMany.mock.calls[0][0];
    expect(firstDelete.where.id.in).toHaveLength(1000);
  });

  it("skips deleteMany entirely when a lab has no victims", async () => {
    homeLabFindMany.mockResolvedValue([{ id: "labA", retentionDays: 30 }]);
    snapshotFindMany.mockResolvedValueOnce([]);

    await pruneOnce();

    expect(snapshotDeleteMany).not.toHaveBeenCalled();
  });

  it("takes() 1000 at a time", async () => {
    homeLabFindMany.mockResolvedValue([{ id: "labA", retentionDays: 30 }]);
    snapshotFindMany.mockResolvedValueOnce([]);

    await pruneOnce();

    expect(snapshotFindMany.mock.calls[0][0].take).toBe(1000);
  });
});
