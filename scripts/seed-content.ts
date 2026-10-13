import { loadConfig } from "../src/server/config";
import { createDatabase } from "../src/server/db/client";
import { seedContent } from "../src/server/seed/content";

const env = { ...process.env };
if (env.NETLIFY_DATABASE_URL_UNPOOLED && !env.DATABASE_URL) env.DATABASE_URL = env.NETLIFY_DATABASE_URL_UNPOOLED;
const handle = createDatabase(loadConfig(env).database);
const result = await seedContent(handle.db);
await handle.close();
console.log(result.seeded ? "Original content seeded (nothing published)." : "Content already seeded; nothing changed.");
