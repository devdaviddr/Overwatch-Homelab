import { describe, it, expect } from "vitest";
import {
  generateRecoveryToken,
  hashRecoveryToken,
  verifyRecoveryToken,
} from "./recoveryToken.js";

describe("recovery tokens", () => {
  it("generates 64-char hex strings", () => {
    const t = generateRecoveryToken();
    expect(t).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces distinct tokens across calls", () => {
    const n = 20;
    const set = new Set<string>();
    for (let i = 0; i < n; i++) set.add(generateRecoveryToken());
    expect(set.size).toBe(n);
  });

  it("round-trips a token through hash + verify", async () => {
    const token = generateRecoveryToken();
    const hash = await hashRecoveryToken(token);
    expect(hash).not.toBe(token);
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyRecoveryToken(token, hash)).toBe(true);
  });

  it("rejects a wrong token against a known hash", async () => {
    const token = generateRecoveryToken();
    const wrong = generateRecoveryToken();
    const hash = await hashRecoveryToken(token);
    expect(await verifyRecoveryToken(wrong, hash)).toBe(false);
  });
});
