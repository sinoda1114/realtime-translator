import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";

const MIGRATION_PATH = join(process.cwd(), "drizzle/migrations/0000_superb_stepford_cuckoos.sql");

export async function createTestDb(): Promise<Database> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });

  const migrationSql = readFileSync(MIGRATION_PATH, "utf-8");
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.execute(statement);
  }

  return db;
}
