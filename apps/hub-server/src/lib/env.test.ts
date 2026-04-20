import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("env validator (H9)", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("parses a complete valid environment", async () => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
    process.env.JWT_SECRET = "a-strong-enough-secret-value";
    process.env.CORS_ORIGIN = "http://localhost:5173";
    process.env.PORT = "4000";

    const { env } = await import("./env.js");
    expect(env.DATABASE_URL).toBe("postgresql://u:p@localhost:5432/db");
    expect(env.JWT_SECRET).toBe("a-strong-enough-secret-value");
    expect(env.PORT).toBe(4000);
  });

  it("exits when JWT_SECRET is missing", async () => {
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
    process.env.CORS_ORIGIN = "http://localhost:5173";

    await expect(import("./env.js")).rejects.toThrow(/process\.exit\(1\)/);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("exits when JWT_SECRET is too short", async () => {
    process.env.JWT_SECRET = "short";
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
    process.env.CORS_ORIGIN = "http://localhost:5173";

    await expect(import("./env.js")).rejects.toThrow(/process\.exit\(1\)/);
  });

  it("exits when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = "a-strong-enough-secret-value";
    process.env.CORS_ORIGIN = "http://localhost:5173";

    await expect(import("./env.js")).rejects.toThrow(/process\.exit\(1\)/);
  });
});
