import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { mkdirSync } from "node:fs";
import pg from "pg";
import { getConfig, type DatabaseConfig } from "../config";
import * as schema from "./schema";

// PGlite's drizzle database has the same query API and result shape (`rows`) at runtime.
export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;

type Handle = { db: DB; close: () => Promise<void>; kind: DatabaseConfig["kind"] };

// One handle per process. Next.js can load this module more than once in development,
// and two PGlite instances must never open the same directory.
const globalKey = Symbol.for("plr.db");
type GlobalWithDb = typeof globalThis & { [globalKey]?: Handle };

export function createDatabase(config: DatabaseConfig): Handle {
  if (config.kind === "postgres") {
    const pool = new pg.Pool({ connectionString: config.url, max: 5, idleTimeoutMillis: 10_000 });
    return { db: drizzlePg(pool, { schema }) as unknown as DB, close: () => pool.end(), kind: "postgres" };
  }
  if (config.dir) mkdirSync(config.dir, { recursive: true });
  const client = config.dir ? new PGlite(config.dir) : new PGlite();
  return { db: drizzlePglite(client, { schema }) as unknown as DB, close: () => client.close(), kind: "pglite" };
}

export function getDb(): DB {
  const g = globalThis as GlobalWithDb;
  if (!g[globalKey]) g[globalKey] = createDatabase(getConfig().database);
  return g[globalKey]!.db;
}

export function getDbKind(): DatabaseConfig["kind"] {
  getDb();
  return (globalThis as GlobalWithDb)[globalKey]!.kind;
}

/** Tests and scripts: install a specific handle (or clear it). */
export function setDatabase(handle: Handle | null) {
  (globalThis as GlobalWithDb)[globalKey] = handle ?? undefined;
}

export { schema };
