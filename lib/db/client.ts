import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { isTursoConfigured, serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let dbInstance: Database | null = null;

export function getDb(): Database {
  if (!isTursoConfigured) {
    throw new Error("Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
  }

  if (!dbInstance) {
    const client = createClient({
      url: serverEnv.TURSO_DATABASE_URL!,
      authToken: serverEnv.TURSO_AUTH_TOKEN!,
    });
    dbInstance = drizzle(client, { schema });
  }

  return dbInstance;
}
