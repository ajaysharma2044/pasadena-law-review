import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import * as s from "@/server/db/schema";
import { expectDbError } from "./helpers/assert";
import { createTestDb } from "./helpers/db";

const expectedTables = [
  "user", "session", "account", "verification", "rate_limit", "memberships", "author_profiles",
  "editorial_applications", "manuscripts", "manuscript_revisions", "review_assignments",
  "review_recommendations", "author_feedback", "internal_notes", "editorial_decisions",
  "publication_checks", "volumes", "issues", "publications", "publication_versions", "meetings",
  "cms_page_versions", "site_settings", "masthead_entries", "attachments", "email_jobs",
  "email_events", "audit_events", "app_rate_limits",
];

describe("migrations on an empty database (PGlite driver)", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  beforeAll(async () => {
    handle = await createTestDb();
  });
  afterAll(() => handle.close());

  it("creates every table", async () => {
    const rows = await handle.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const names = rows.rows.map((r) => r.table_name);
    for (const t of expectedTables) expect(names).toContain(t);
  });

  it("is idempotent", async () => {
    await expect(runMigrations(handle.db, "pglite")).resolves.toBeUndefined();
  });

  it("keeps revisions immutable, but lets a deleted account's reference become null", async () => {
    const db = handle.db;
    await db.insert(s.user).values([
      { id: "author1", name: "Author", email: "a@example.org" },
      { id: "editor1", name: "Editor", email: "e@example.org" },
    ]);
    const [m] = await db.insert(s.manuscripts).values({ authorId: "author1", kind: "essay", title: "T" }).returning();
    const [rev] = await db
      .insert(s.manuscriptRevisions)
      .values({
        manuscriptId: m.id, seq: 1, source: "editor_edit", kind: "essay", title: "T", deck: "",
        abstract: "", bodyMd: "Body", authorBio: "", disclosure: "", createdBy: "editor1",
      })
      .returning();
    await expectDbError(db.execute(sql`update manuscript_revisions set body_md = 'changed' where id = ${rev.id}`), /immutable/);
    await expectDbError(db.execute(sql`delete from manuscript_revisions where id = ${rev.id}`), /immutable/);
    await db.execute(sql`delete from "user" where id = 'editor1'`);
    const after = await db.execute<{ created_by: string | null; body_md: string }>(
      sql`select created_by, body_md from manuscript_revisions where id = ${rev.id}`,
    );
    expect(after.rows[0]).toEqual({ created_by: null, body_md: "Body" });
  });

  it("keeps audit events immutable", async () => {
    const db = handle.db;
    const [ev] = await db.insert(s.auditEvents).values({ action: "test", targetType: "x", targetId: "1" }).returning();
    await expectDbError(db.execute(sql`update audit_events set action = 'edited' where id = ${ev.id}`), /immutable/);
    await expectDbError(db.execute(sql`delete from audit_events where id = ${ev.id}`), /immutable/);
  });

  it("refuses an announced meeting without a time", async () => {
    await expectDbError(handle.db.insert(s.meetings).values({ status: "announced" }), /announced_has_time/);
  });
});

describe("migrations through the production driver (node-postgres)", () => {
  let pglite: PGlite;
  let server: PGLiteSocketServer;
  let port = 0;
  beforeAll(async () => {
    pglite = await PGlite.create();
    server = new PGLiteSocketServer({ db: pglite, port: 0, host: "127.0.0.1" });
    await server.start();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    port = ((server as any).server?.address?.() ?? {}).port;
  });
  afterAll(async () => {
    await server.stop();
    await pglite.close();
  });

  it("applies the same migrations over a real Postgres wire connection", async () => {
    expect(port).toBeGreaterThan(0);
    const handle = createDatabase({ kind: "postgres", url: `postgres://postgres@127.0.0.1:${port}/postgres` });
    try {
      await runMigrations(handle.db, "postgres");
      const rows = await handle.db.execute<{ n: number }>(
        sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
      );
      expect(rows.rows[0].n).toBeGreaterThanOrEqual(expectedTables.length);
    } finally {
      await handle.close();
    }
  });
});
