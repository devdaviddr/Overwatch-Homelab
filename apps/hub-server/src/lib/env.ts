import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }),
  JWT_SECRET: z.string().min(16, { message: "JWT_SECRET must be at least 16 characters" }),
  CORS_ORIGIN: z.string().url({ message: "CORS_ORIGIN must be a valid URL" }),
  PORT: z
    .string()
    .optional()
    .default("3001")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  JWT_EXPIRES_IN: z.string().optional().default("7d"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    console.error(`[Hub Server] Environment validation failed:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = parseEnv();
