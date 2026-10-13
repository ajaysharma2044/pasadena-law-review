import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as attachmentRoute from "@/app/api/attachments/[id]/route";
import * as attachmentDelete from "@/app/api/attachments/[id]/delete/route";
import * as decisionRoute from "@/app/api/admin/manuscripts/[id]/decision/route";
import * as publishRoute from "@/app/api/admin/manuscripts/[id]/publish/route";
import * as claimRoute from "@/app/api/editor/manuscripts/[id]/claim/route";
import * as jobsRoute from "@/app/api/jobs/run/route";
import * as createRoute from "@/app/api/manuscripts/route";
import * as saveRoute from "@/app/api/manuscripts/[id]/route";
import * as uploadRoute from "@/app/api/manuscripts/[id]/attachments/route";
import * as submitRoute from "@/app/api/manuscripts/[id]/submit/route";
import * as previewRoute from "@/app/api/preview/route";
import { call, setupApp } from "./helpers/app";
import { makeUser } from "./helpers/users";

const SECRET = "s".repeat(32);
let handle: Awaited<ReturnType<typeof setupApp>>;
beforeEach(async () => {
  handle = await setupApp({ CRON_SECRET: SECRET });
});
afterEach(() => handle.close());

const PDF = new TextEncoder().encode("%PDF-1.7\n%%EOF");

describe("direct requests across ownership and role boundaries", () => {
  it("keeps one author's manuscript and files away from another author, anonymous visitors and members", async () => {
    const a = await makeUser("a@example.org");
    const b = await makeUser("b@example.org");
    const editor = await makeUser("ed@example.org", "editor");

    const { id } = (await (await call(createRoute, "POST", "/api/manuscripts", { cookie: a.cookie, json: { kind: "essay" } })).json()) as { id: string };
    const saved = await call(saveRoute, "POST", `/api/manuscripts/${id}`, { cookie: a.cookie, params: { id }, json: { expectedVersion: 1, title: "Mine", bodyMd: "Text" } });
    expect(saved.status).toBe(200);

    const fd = new FormData();
    fd.append("file", new File([PDF], "paper.pdf", { type: "application/pdf" }));
    const up = await call(uploadRoute, "POST", `/api/manuscripts/${id}/attachments`, { cookie: a.cookie, params: { id }, body: fd });
    expect(up.status).toBe(200);
    const fileId = ((await up.json()) as { id: string }).id;

    // another author
    expect((await call(saveRoute, "POST", `/api/manuscripts/${id}`, { cookie: b.cookie, params: { id }, json: { expectedVersion: 2, title: "Hijack" } })).status).toBe(404);
    expect((await call(submitRoute, "POST", `/api/manuscripts/${id}/submit`, { cookie: b.cookie, params: { id }, json: { expectedVersion: 2 } })).status).toBe(404);
    expect((await call(attachmentRoute, "GET", `/api/attachments/${fileId}`, { cookie: b.cookie, params: { id: fileId }, origin: null })).status).toBe(404);
    expect((await call(attachmentDelete, "POST", `/api/attachments/${fileId}/delete`, { cookie: b.cookie, params: { id: fileId }, json: {} })).status).toBe(404);
    const bUpload = new FormData();
    bUpload.append("file", new File([PDF], "x.pdf"));
    expect((await call(uploadRoute, "POST", `/api/manuscripts/${id}/attachments`, { cookie: b.cookie, params: { id }, body: bUpload })).status).toBe(404);

    // anonymous
    expect((await call(attachmentRoute, "GET", `/api/attachments/${fileId}`, { params: { id: fileId }, origin: null })).status).toBe(401);

    // editors can't see a private draft's file
    expect((await call(attachmentRoute, "GET", `/api/attachments/${fileId}`, { cookie: editor.cookie, params: { id: fileId }, origin: null })).status).toBe(404);

    const sub = await call(submitRoute, "POST", `/api/manuscripts/${id}/submit`, {
      cookie: a.cookie,
      params: { id },
      json: { expectedVersion: 2, confirm_authorship: "on", confirm_sources: "on", confirm_disclosure: "on" },
    });
    expect(sub.status).toBe(200);

    // after submission an editor may download, served as a download with no sniffing or caching
    const dl = await call(attachmentRoute, "GET", `/api/attachments/${fileId}`, { cookie: editor.cookie, params: { id: fileId }, origin: null });
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(dl.headers.get("x-content-type-options")).toBe("nosniff");
    expect(dl.headers.get("cache-control")).toContain("no-store");

    // a member can't act as an editor
    expect((await call(claimRoute, "POST", `/api/editor/manuscripts/${id}/claim`, { cookie: b.cookie, params: { id }, json: {} })).status).toBe(403);
    // an editor can't decide or publish
    expect((await call(decisionRoute, "POST", `/api/admin/manuscripts/${id}/decision`, { cookie: editor.cookie, params: { id }, json: { expectedVersion: 3, decision: "accept" } })).status).toBe(403);
    expect((await call(publishRoute, "POST", `/api/admin/manuscripts/${id}/publish`, { cookie: editor.cookie, params: { id }, json: { revisionId: "x", slug: "x", byline: "x" } })).status).toBe(403);
  });

  it("refuses an upload that isn't really a PDF", async () => {
    const a = await makeUser("a@example.org");
    const { id } = (await (await call(createRoute, "POST", "/api/manuscripts", { cookie: a.cookie, json: { kind: "note" } })).json()) as { id: string };
    const fd = new FormData();
    fd.append("file", new File([new TextEncoder().encode("MZ\u0090 not a pdf")], "paper.pdf", { type: "application/pdf" }));
    const res = await call(uploadRoute, "POST", `/api/manuscripts/${id}/attachments`, { cookie: a.cookie, params: { id }, body: fd });
    expect(res.status).toBe(422);
  });

  it("sanitizes the editor preview the same way as published articles", async () => {
    const a = await makeUser("a@example.org");
    const res = await call(previewRoute, "POST", "/api/preview", { cookie: a.cookie, json: { bodyMd: "Hi <script>alert(1)</script> [x](javascript:alert(1))" } });
    const { html } = (await res.json()) as { html: string };
    expect(html).not.toMatch(/<script|javascript:/);
  });

  it("requires the scheduler secret to run jobs", async () => {
    expect((await call(jobsRoute, "POST", "/api/jobs/run", { origin: null })).status).toBe(401);
    expect((await call(jobsRoute, "POST", "/api/jobs/run", { origin: null, headers: { authorization: `Bearer ${"x".repeat(32)}` } })).status).toBe(401);
    expect((await call(jobsRoute, "POST", "/api/jobs/run", { origin: null, headers: { authorization: `Bearer ${SECRET}` } })).status).toBe(200);
  });
});
