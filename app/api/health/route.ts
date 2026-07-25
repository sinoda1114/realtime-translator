import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isOpenAiConfigured, isTursoConfigured } from "@/lib/env";

export async function GET() {
  let dbStatus: "ok" | "error" | "not_configured" = "not_configured";

  if (isTursoConfigured) {
    try {
      await getDb().run(sql`SELECT 1`);
      dbStatus = "ok";
    } catch {
      dbStatus = "error";
    }
  }

  return NextResponse.json({
    status: dbStatus === "error" ? "error" : "ok",
    db: dbStatus,
    openAiConfigured: isOpenAiConfigured,
  });
}
