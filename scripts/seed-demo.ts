import { eq } from "drizzle-orm";
import { getAuth } from "../src/server/auth";
import { getConfig } from "../src/server/config";
import { createDatabase, setDatabase } from "../src/server/db/client";
import { runMigrations } from "../src/server/db/migrate";
import * as s from "../src/server/db/schema";
import { seedContent } from "../src/server/seed/content";

/**
 * Synthetic demo accounts for local development and end-to-end tests ONLY.
 * Refuses to run against a production configuration.
 */
const config = getConfig();
if (config.strict || config.database.kind !== "pglite") {
  console.error("Refusing to create demo accounts outside a local PGlite database.");
  process.exit(1);
}
const password = process.env.DEMO_PASSWORD ?? "demo-pass-2026!";
const DEMO = [
  ["admin@demo.test", "Demo Administrator", "admin"],
  ["editor1@demo.test", "Demo Editor One", "editor"],
  ["editor2@demo.test", "Demo Editor Two", "editor"],
] as const;

const handle = createDatabase(config.database);
setDatabase(handle);
await runMigrations(handle.db, "pglite");
await seedContent(handle.db);
for (const [email, name, role] of DEMO) {
  const [existing] = await handle.db.select().from(s.user).where(eq(s.user.email, email));
  if (!existing) await getAuth().api.signUpEmail({ body: { name, email, password } });
  const [u] = await handle.db.select().from(s.user).where(eq(s.user.email, email));
  await handle.db.update(s.user).set({ emailVerified: true }).where(eq(s.user.id, u.id));
  await handle.db.update(s.memberships).set({ role }).where(eq(s.memberships.userId, u.id));
}
await handle.db.delete(s.emailJobs); // demo sign-ups don't need confirmation mail
await handle.close();
console.log(`Demo accounts ready (${DEMO.map((d) => d[0]).join(", ")}).`);
