import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "./pagination.js";

describe("cursor pagination", () => {
  it("round-trips (createdAt, id) through base64url", () => {
    const row = { createdAt: new Date("2026-03-01T12:34:56.789Z"), id: "abc-123" };
    const cursor = encodeCursor(row);
    expect(cursor).not.toContain("/");
    expect(cursor).not.toContain("+");
    expect(cursor).not.toContain("=");

    const decoded = decodeCursor(cursor);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(row.id);
    expect(decoded!.createdAt.toISOString()).toBe(row.createdAt.toISOString());
  });

  it("returns null for malformed cursors", () => {
    expect(decodeCursor(Buffer.from("no-separator").toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from("not-a-date|some-id").toString("base64url"))).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("handles UUIDs and timestamps at microsecond precision", () => {
    const row = { createdAt: new Date("2026-12-31T23:59:59.999Z"), id: "00000000-0000-0000-0000-000000000001" };
    const decoded = decodeCursor(encodeCursor(row));
    expect(decoded!.id).toBe(row.id);
    expect(decoded!.createdAt.getTime()).toBe(row.createdAt.getTime());
  });
});
