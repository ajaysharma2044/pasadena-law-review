import { loadConfig } from "../src/server/config";
import { createDatabase } from "../src/server/db/client";
import { seedContent } from "../src/server/seed/content";

const env = { ...process.env };
// Prefer a direct (unpooled) connection for operator scripts when one is provided.
const direct = env.DATABASE_URL_UNPOOLED ?? env.NETLIFY_DATABASE_URL_UNPOOLED;
if (direct) env.DATABASE_URL = direct;
const handle = createDatabase(loadConfig(env).database);
const result = await seedContent(handle.db);
await handle.close();
console.log(result.seeded ? "Original content seeded (nothing published)." : result.renamed ? `Content already seeded; renamed ${result.renamed} untouched page(s).` : "Content already seeded; nothing changed.");
