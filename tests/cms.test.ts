import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { seedContent, ARTICLE_TITLE } from "@/server/seed/content";
import * as cms from "@/server/services/cms";
import { getNextMeeting, getPublishedMasthead, getPublishedPage, listLive, listVisibleIssues } from "@/server/services/public-content";
import { getSettings } from "@/server/services/settings";
import { setupApp } from "./helpers/app";
import { actor } from "./helpers/actors";

let handle: Awaited<ReturnType<typeof setupApp>>;
beforeEach(async () => {
  handle = await setupApp();
});
afterEach(() => handle.close());

const status = (p: Promise<unknown>) =>
  p.then(
    () => 0,
    (e) => (e instanceof AppError ? e.status : -1),
  );

describe("original content seed", () => {
  it("imports the article as unpublished with open checks, hides the planned issue, and is idempotent", async () => {
    expect((await seedContent(getDb())).seeded).toBe(true);
    expect((await seedContent(getDb())).seeded).toBe(false);
    const [article] = await getDb().select().from(s.manuscripts).where(eq(s.manuscripts.title, ARTICLE_TITLE));
    expect(article.authorId).toBeNull();
    expect(article.status).toBe("submitted");
    const checks = await getDb().select().from(s.publicationChecks).where(eq(s.publicationChecks.manuscriptId, article.id));
    expect(checks.length).toBeGreaterThanOrEqual(5);
    expect(checks.every((c) => !c.resolved)).toBe(true);
    expect(await listLive()).toHaveLength(0);
    expect(await listVisibleIssues()).toHaveLength(0);
    expect(await getNextMeeting()).toBeNull(); // the seeded meeting is an unannounced draft
    expect((await getPublishedPage("about"))?.html).toContain("student journal");
    expect((await getPublishedPage("submissions"))?.html).not.toMatch(/\[email/i);
  });
});

describe("page changes", () => {
  it("an editor's proposal doesn't change the public page until an administrator publishes it", async () => {
    await seedContent(getDb());
    const editor = await actor("editor");
    const admin = await actor("admin");
    const before = (await getPublishedPage("about"))!.html;
    const { id } = await cms.proposePage(editor, "about", "A **new** About page.", "Rewrite");
    expect((await getPublishedPage("about"))!.html).toBe(before);
    expect(await status(cms.publishPageVersion(editor, id))).toBe(403);
    await cms.publishPageVersion(admin, id);
    expect((await getPublishedPage("about"))!.html).toContain("<strong>new</strong>");
    const versions = await cms.pageVersions("about");
    expect(versions.filter((v) => v.status === "published")).toHaveLength(1);
    expect(versions.some((v) => v.status === "superseded")).toBe(true);
  });

  it("members can't propose page changes", async () => {
    expect(await status(cms.proposePage(await actor(), "about", "x", ""))).toBe(403);
  });
});

describe("meetings", () => {
  it("stores the time in UTC from the meeting's own time zone", () => {
    expect(cms.zonedToUtc("2026-10-20T18:30", "America/Los_Angeles").toISOString()).toBe("2026-10-21T01:30:00.000Z");
    expect(cms.zonedToUtc("2026-12-01T09:00", "America/Los_Angeles").toISOString()).toBe("2026-12-01T17:00:00.000Z");
    expect(cms.utcToLocalInput(new Date("2026-10-21T01:30:00Z"), "America/Los_Angeles")).toBe("2026-10-20T18:30");
  });

  it("editors keep meetings in draft; only administrators announce them", async () => {
    const editor = await actor("editor");
    const admin = await actor("admin");
    const base = {
      status: "draft", startsAtLocal: "", timezone: "America/Los_Angeles", location: "", motion: "Resolved, That x.",
      openerFor: "", openerAgainst: "", attendancePolicy: "Any PCC student", minutesMd: "", minutesPublished: false,
    };
    const { id } = await cms.saveMeeting(editor, null, null, base);
    expect(await getNextMeeting()).toBeNull();
    const future = new Date(Date.now() + 7 * 864e5);
    const local = cms.utcToLocalInput(future, "America/Los_Angeles");
    expect(await status(cms.saveMeeting(editor, id, 1, { ...base, status: "announced", startsAtLocal: local }))).toBe(403);
    expect(await status(cms.saveMeeting(admin, id, 1, { ...base, status: "announced", startsAtLocal: "" }))).toBe(422);
    await cms.saveMeeting(admin, id, 1, { ...base, status: "announced", startsAtLocal: local, location: "Room 101" });
    expect((await getNextMeeting())?.location).toBe("Room 101");
    expect(await status(cms.saveMeeting(editor, id, 2, { ...base }))).toBe(403); // public now
    expect(await status(cms.saveMeeting(admin, id, 1, { ...base, status: "announced", startsAtLocal: local }))).toBe(409); // stale
  });
});

describe("settings, issues and masthead", () => {
  it("validates settings and keeps the masthead hidden until real names are published", async () => {
    const admin = await actor("admin");
    const editor = await actor("editor");
    expect(await status(cms.updateSettings(editor, { contact_email: "editors@example.org" }))).toBe(403);
    expect(await status(cms.updateSettings(admin, { contact_email: "not-an-email" }))).toBe(422);
    expect(await status(cms.updateSettings(admin, { timezone: "Mars/Olympus" }))).toBe(422);
    await cms.updateSettings(admin, { contact_email: "editors@example.org" });
    expect((await getSettings()).contact_email).toBe("editors@example.org");

    expect(await getPublishedMasthead()).toBeNull();
    expect(await status(cms.saveMasthead(admin, [{ roleTitle: "Editor-in-Chief", personName: "" }], true))).toBe(422);
    await cms.saveMasthead(admin, [{ roleTitle: "Editor-in-Chief", personName: "Real Person" }], false);
    expect(await getPublishedMasthead()).toBeNull();
    await cms.saveMasthead(admin, [{ roleTitle: "Editor-in-Chief", personName: "Real Person" }], true);
    expect((await getPublishedMasthead())?.[0].personName).toBe("Real Person");
  });

  it("only shows issues an administrator made visible", async () => {
    const admin = await actor("admin");
    const vol = await cms.createVolume(admin, 3, "Volume III", "2028–29");
    const issue = await cms.saveIssue(admin, { volumeId: vol.id, number: 1, termLabel: "Fall 2028", visible: false, sortOrder: 1 });
    expect(await listVisibleIssues()).toHaveLength(0);
    await cms.saveIssue(admin, { id: issue.id, volumeId: vol.id, number: 1, termLabel: "Fall 2028", visible: true, sortOrder: 1 });
    expect((await listVisibleIssues())[0].termLabel).toBe("Fall 2028");
  });
});
