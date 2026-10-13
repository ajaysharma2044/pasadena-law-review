import { loadConfig } from "../src/server/config";
import { createDatabase, setDatabase } from "../src/server/db/client";
import { processDueEmails } from "../src/server/email/outbox";

/**
 * Sends every queued email that is due, then exits. On Netlify the scheduled function does this
 * every five minutes; run it by hand (or from cron on another host) when that is not running.
 *   npm run jobs:run
 * Uses the site's own settings: the database, EMAIL_TRANSPORT, RESEND_API_KEY and EMAIL_FROM.
 */
const env = { ...process.env };
// Prefer a direct (unpooled) connection for operator scripts when one is provided.
const direct = env.DATABASE_URL_UNPOOLED ?? env.NETLIFY_DATABASE_URL_UNPOOLED;
if (direct) env.DATABASE_URL = direct;
const handle = createDatabase(loadConfig(env).database);
setDatabase(handle);
const counts: Record<string, number> = {};
try {
  // A failed attempt is rescheduled into the future, so this stops once nothing is due.
  for (let round = 0; round < 50; round++) {
    const results = await processDueEmails({ limit: 25 });
    if (!results.length) break;
    for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  }
  console.log(Object.keys(counts).length ? counts : "No emails were due.");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  setDatabase(null);
  await handle.close();
}
