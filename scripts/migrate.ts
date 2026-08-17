import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

if (url.startsWith("libsql:") && !authToken) {
  throw new Error("TURSO_AUTH_TOKEN is required for a remote Turso database");
}

const client = createClient({ url, authToken });
const db = drizzle(client);

await migrate(db, { migrationsFolder: "drizzle/migrations" });
client.close();

console.info("Database migrations applied successfully.");
