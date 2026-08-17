import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

export const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
export const now = sql`(unixepoch() * 1000)`;
