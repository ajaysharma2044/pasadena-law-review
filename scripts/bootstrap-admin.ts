import { loadConfig } from "../src/server/config";
import { createDatabase } from "../src/server/db/client";
import { bootstrapAdmin } from "../src/server/services/members";

/**
 * Makes an existing, email-verified account the first administrator.
 * Usage: npm run admin:bootstrap -- someone@example.org
 * Refuses if any active administrator already exists.
 */
const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run admin:bootstrap -- <email of a verified account>");
  process.exit(1);
}
const env = { ...process.env };
// Prefer a direct (unpooled) connection for operator scripts when one is provided.
const direct = env.DATABASE_URL_UNPOOLED ?? env.NETLIFY_DATABASE_URL_UNPOOLED;
if (direct) env.DATABASE_URL = direct;
const handle = createDatabase(loadConfig(env).database);
try {
  await bootstrapAdmin(handle.db, email);
  console.log(`${email} is now an administrator.`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await handle.close();
}
