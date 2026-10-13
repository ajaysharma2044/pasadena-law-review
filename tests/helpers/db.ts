import { createDatabase, setDatabase } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";

/** A fresh in-memory Postgres (PGlite) with every migration applied, installed as the app database. */
export async function createTestDb() {
  const handle = createDatabase({ kind: "pglite", dir: null });
  await runMigrations(handle.db, "pglite");
  setDatabase(handle);
  return handle;
}
