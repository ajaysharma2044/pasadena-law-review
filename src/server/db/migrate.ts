import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import type { DB } from "./client";

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

/** Applies every pending SQL migration in ./drizzle. Safe to run repeatedly. */
export async function runMigrations(db: DB, kind: "postgres" | "pglite", folder = MIGRATIONS_FOLDER) {
  if (kind === "postgres") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePg(db as any, { migrationsFolder: folder });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePglite(db as any, { migrationsFolder: folder });
  }
}
