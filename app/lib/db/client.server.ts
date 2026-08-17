import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { getServerEnv } from "~/lib/env.server";

import * as schema from "./schema";

const env = getServerEnv();

export const databaseClient = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(databaseClient, { schema });
