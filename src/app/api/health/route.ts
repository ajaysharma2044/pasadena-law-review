import { sql } from "drizzle-orm";
import { getConfig } from "@/server/config";
import { getDb, getDbKind } from "@/server/db/client";

export const dynamic = "force-dynamic";

/** Reports reachability and which adapters are configured. Never reports secret values. */
export async function GET() {
  const config = getConfig();
  let database: "up" | "down" = "down";
  let migrations: number | null = null;
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    database = "up";
    const r = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    migrations = r.rows[0]?.n ?? 0;
  } catch {
    database = "down";
  }
  const body = {
    status: database === "up" ? "ok" : "degraded",
    mode: config.mode,
    database: { state: database, driver: database === "up" ? getDbKind() : config.database.kind, migrationsApplied: migrations },
    email: { transport: config.email.transport, webhookVerification: config.email.transport === "resend" ? Boolean(config.email.webhookSecret) : null },
    storage: { driver: config.storage.driver },
    jobsRunnerProtected: Boolean(config.cronSecret),
  };
  return Response.json(body, { status: database === "up" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
