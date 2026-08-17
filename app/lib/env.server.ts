import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().min(1).optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  APP_URL: z.url(),
  EMAIL_PROVIDER: z.enum(["console"]).default("console"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const isProduction = process.env.NODE_ENV === "production";
  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    TURSO_DATABASE_URL:
      process.env.TURSO_DATABASE_URL ?? (isProduction ? undefined : "file:local.db"),
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || undefined,
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ??
      (isProduction ? undefined : "kinder-tasks-local-development-secret-change-before-production"),
    APP_URL: process.env.APP_URL ?? (isProduction ? undefined : "http://localhost:5173"),
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
  });

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid server environment configuration: ${fields}`);
  }

  if (parsed.data.TURSO_DATABASE_URL.startsWith("libsql:") && !parsed.data.TURSO_AUTH_TOKEN) {
    throw new Error("TURSO_AUTH_TOKEN is required for a remote Turso database");
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
