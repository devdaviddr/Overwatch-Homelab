// Vitest global setup — seeds the env vars that env.ts requires at import
// time. Individual tests that exercise env validation may override these.

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.JWT_SECRET ??= "unit-test-jwt-secret-value-0000";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.NODE_ENV ??= "test";
