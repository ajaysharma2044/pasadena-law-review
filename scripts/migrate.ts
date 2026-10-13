import { loadConfig } from "../src/server/config";
import { createDatabase } from "../src/server/db/client";
import { runMigrations } from "../src/server/db/migrate";

// Migrations use the direct (unpooled) connection when Netlify DB provides one.
const env = { ...process.env };
if (env.NETLIFY_DATABASE_URL_UNPOOLED && !env.DATABASE_URL) env.DATABASE_URL = env.NETLIFY_DATABASE_URL_UNPOOLED;
const config = loadConfig(env);
const handle = createDatabase(config.database);
await runMigrations(handle.db, handle.kind);
await handle.close();
console.log(`Migrations applied (${handle.kind}).`);
