import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { count } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import * as s from "@/server/db/schema";
import * as m from "@/server/services/manuscripts";
import { setupApp } from "./helpers/app";
import { actor } from "./helpers/actors";

let handle: Awaited<ReturnType<typeof setupApp>>;
beforeEach(async () => {
  handle = await setupApp();
});
afterEach(() => handle.close());

describe("database backup and restore (local PGlite)", () => {
  it("dumps the data directory and restores it into a fresh database with the same rows", async () => {
    const author = await actor();
    const { id } = await m.createDraft(author, "essay");
    await m.saveDraft(author, id, 1, { title: "Backed up", bodyMd: "Text." });
    // Reach the underlying PGlite client through a fresh query to make sure everything is written.
    const before = await getDb().select({ n: count() }).from(s.manuscripts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (getDb() as any).$client as PGlite;
    const dump = await client.dumpDataDir("gzip");
    const restored = new PGlite({ loadDataDir: dump });
    const db2 = drizzle(restored, { schema: s });
    const after = await db2.select({ n: count() }).from(s.manuscripts);
    const [row] = await db2.select().from(s.manuscripts);
    expect(after[0].n).toBe(before[0].n);
    expect(row.title).toBe("Backed up");
    await restored.close();
  });
});
