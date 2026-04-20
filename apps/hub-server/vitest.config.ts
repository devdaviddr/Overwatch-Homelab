import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    testTimeout: 10_000,
    pool: "forks",
    setupFiles: ["./src/test-setup.ts"],
  },
});
