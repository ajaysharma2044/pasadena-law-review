import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isNull } from "drizzle-orm";
import { loadConfig } from "../src/server/config";
import { createDatabase } from "../src/server/db/client";
import { attachments } from "../src/server/db/schema";
import { getStorage } from "../src/server/storage";

/**
 * Copies every live attachment object out of the configured storage into a local folder, or back in.
 *   npm run attachments:backup -- ./backups/2026-10-13
 *   npm run attachments:restore -- ./backups/2026-10-13
 * The database must be backed up separately (see docs/operations.md); object keys come from it.
 */
const [mode, dir] = [process.argv[2], process.argv[3]];
if ((mode !== "backup" && mode !== "restore") || !dir) {
  console.error("Usage: tsx scripts/backup-attachments.ts backup|restore <folder>");
  process.exit(1);
}
const env = { ...process.env };
if (env.NETLIFY_DATABASE_URL_UNPOOLED && !env.DATABASE_URL) env.DATABASE_URL = env.NETLIFY_DATABASE_URL_UNPOOLED;
const handle = createDatabase(loadConfig(env).database);
const storage = getStorage();
const rows = await handle.db.select().from(attachments).where(isNull(attachments.deletedAt));
let copied = 0;
let missing = 0;
if (mode === "backup") {
  await mkdir(dir, { recursive: true });
  for (const a of rows) {
    const bytes = await storage.get(a.storageKey);
    if (!bytes) {
      missing++;
      continue;
    }
    await writeFile(path.join(dir, a.storageKey), bytes);
    copied++;
  }
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(rows.map((a) => ({ key: a.storageKey, sha256: a.sha256, mime: a.mime })), null, 2));
} else {
  const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")) as { key: string; mime: string }[];
  const present = new Set(await readdir(dir));
  for (const item of manifest) {
    if (!present.has(item.key)) {
      missing++;
      continue;
    }
    if (await storage.get(item.key)) continue; // already there
    await storage.put(item.key, new Uint8Array(await readFile(path.join(dir, item.key))), item.mime);
    copied++;
  }
}
await handle.close();
console.log(`${mode}: ${copied} copied, ${missing} missing, ${rows.length} attachments in the database.`);
if (missing) process.exitCode = 2;
