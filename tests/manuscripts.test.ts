import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { updateSettings } from "@/server/services/cms";
import * as m from "@/server/services/manuscripts";
import { getLiveArticle, listLive, listVisibleIssues } from "@/server/services/public-content";
import { setupApp } from "./helpers/app";
import { actor, sampleBody } from "./helpers/actors";

let handle: Awaited<ReturnType<typeof setupApp>>;
beforeEach(async () => {
  handle = await setupApp();
});
afterEach(() => handle.close());

async function expectCode(p: Promise<unknown>, status: number, code?: string) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    expect((e as AppError).status).toBe(status);
    if (code) expect((e as AppError).code).toBe(code);
    return;
  }
  throw new Error(`expected AppError ${status}${code ? ` ${code}` : ""}`);
}

const confirmations = { authorship: true, sources: true, disclosure: true };

async function draftAndSubmit(author: Awaited<ReturnType<typeof actor>>, title = "On Parking Appeals") {
  const { id } = await m.createDraft(author, "essay");
  const saved = await m.saveDraft(author, id, 1, { title, deck: "A deck", abstract: "Short abstract.", bodyMd: sampleBody, authorBio: "Student." });
  await m.submit(author, id, saved.version, confirmations);
  return id;
}

async function reviewToAcceptance(id: string, ed1: Awaited<ReturnType<typeof actor>>, ed2: Awaited<ReturnType<typeof actor>>, admin: Awaited<ReturnType<typeof actor>>) {
  await m.claim(ed1, id);
  await m.claim(ed2, id);
  const view = await m.getForEditor(ed1, id);
  await m.recommend(ed1, id, view.manuscript.currentRevisionId!, "accept", "Strong.");
  await m.recommend(ed2, id, view.manuscript.currentRevisionId!, "accept", "Good.");
  const fresh = await m.getForEditor(admin, id);
  await m.decide(admin, id, fresh.manuscript.version, "accept", "Accepted pending cite-check.");
}

describe("S3: author drafts and submissions", () => {
  it("saves drafts with version checks and rejects a stale save", async () => {
    const author = await actor();
    const { id } = await m.createDraft(author, "essay");
    const a = await m.saveDraft(author, id, 1, { title: "First" });
    expect(a.version).toBe(2);
    await expectCode(m.saveDraft(author, id, 1, { title: "Stale tab" }), 409, "stale");
    const mine = await m.getForAuthor(author, id);
    expect(mine.manuscript.title).toBe("First");
  });

  it("requires a title, body and the three confirmations to submit", async () => {
    const author = await actor();
    const { id } = await m.createDraft(author, "note");
    await expectCode(m.submit(author, id, 1, confirmations), 422);
    const saved = await m.saveDraft(author, id, 1, { title: "T", bodyMd: "Body" });
    await expectCode(m.submit(author, id, saved.version, { authorship: true, sources: false, disclosure: true }), 422);
    await m.submit(author, id, saved.version, confirmations);
    const view = await m.getForAuthor(author, id);
    expect(view.manuscript.status).toBe("submitted");
    expect(view.revisions).toHaveLength(1);
  });

  it("sends a receipt to the author and a notice to editors on submission", async () => {
    const author = await actor();
    await actor("editor");
    await draftAndSubmit(author);
    const jobs = await getDb().select().from(s.emailJobs);
    expect(jobs.filter((j) => j.kind === "submission_received" && j.toEmail === author.email)).toHaveLength(1);
    expect(jobs.filter((j) => j.kind === "new_submission").length).toBeGreaterThanOrEqual(1);
    expect(jobs.every((j) => !j.textBody.includes("More text."))).toBe(true); // no manuscript text in email
  });

  it("locks the author's copy while under review", async () => {
    const author = await actor();
    const id = await draftAndSubmit(author);
    const view = await m.getForAuthor(author, id);
    await expectCode(m.saveDraft(author, id, view.manuscript.version, { title: "Sneaky edit" }), 409, "invalid_transition");
  });

  it("keeps another author out of the manuscript entirely", async () => {
    const author = await actor();
    const other = await actor();
    const id = await draftAndSubmit(author);
    await expectCode(m.getForAuthor(other, id), 404);
    await expectCode(m.saveDraft(other, id, 1, { title: "x" }), 404);
    await expectCode(m.withdraw(other, id), 404);
    await expectCode(m.getForEditor(other, id), 403);
  });

  it("lets the author withdraw before publication, keeping history", async () => {
    const author = await actor();
    const id = await draftAndSubmit(author);
    await m.withdraw(author, id);
    const view = await m.getForAuthor(author, id);
    expect(view.manuscript.status).toBe("withdrawn");
    expect(view.revisions).toHaveLength(1);
    await expectCode(m.withdraw(author, id), 409, "invalid_transition");
  });

  it("never exposes drafts or unpublished work on public routes", async () => {
    const author = await actor();
    const { id } = await m.createDraft(author, "essay");
    await m.saveDraft(author, id, 1, { title: "Secret Draft", bodyMd: "Private." });
    await draftAndSubmit(author, "Submitted Piece");
    expect(await listLive()).toHaveLength(0);
    expect(await getLiveArticle("secret-draft")).toBeNull();
    expect(await listVisibleIssues()).toHaveLength(0);
  });
});

describe("S4: review, recommendations and decisions", () => {
  it("blocks self-review and self-decision", async () => {
    const editorAuthor = await actor("editor");
    const id = await draftAndSubmit(editorAuthor);
    await expectCode(m.claim(editorAuthor, id), 403, "self_review");
    const adminAuthor = await actor("admin");
    const id2 = await draftAndSubmit(adminAuthor);
    const v = await m.getForEditor(await actor("admin"), id2);
    await expectCode(m.decide(adminAuthor, id2, v.manuscript.version, "accept", ""), 403, "self_decision");
  });

  it("requires two recommendations from two different editors on the current revision before acceptance", async () => {
    const author = await actor();
    const [ed1, ed2, admin] = [await actor("editor"), await actor("editor"), await actor("admin")];
    const id = await draftAndSubmit(author);
    await m.claim(ed1, id);
    const v1 = await m.getForEditor(ed1, id);
    await m.recommend(ed1, id, v1.manuscript.currentRevisionId!, "accept", "Yes.");
    await expectCode(m.recommend(ed1, id, v1.manuscript.currentRevisionId!, "accept", "Again."), 409);
    const before = await m.getForEditor(admin, id);
    await expectCode(m.decide(admin, id, before.manuscript.version, "accept", ""), 409, "reviews_required");
    await m.claim(ed2, id);
    await m.recommend(ed2, id, v1.manuscript.currentRevisionId!, "changes", "Fix note 1.");
    const after = await m.getForEditor(admin, id);
    await m.decide(admin, id, after.manuscript.version, "accept", "");
    expect((await m.getForAuthor(author, id)).manuscript.status).toBe("accepted");
  });

  it("only assigned editors may recommend", async () => {
    const author = await actor();
    const ed = await actor("editor");
    const id = await draftAndSubmit(author);
    const v = await m.getForEditor(ed, id);
    await expectCode(m.recommend(ed, id, v.manuscript.currentRevisionId!, "accept", ""), 403, "not_assigned");
  });

  it("runs changes requested, resubmission, a second round, acceptance and publication", async () => {
    const author = await actor();
    const [ed1, ed2, admin] = [await actor("editor"), await actor("editor"), await actor("admin")];
    const id = await draftAndSubmit(author);
    await m.claim(ed1, id);
    await m.claim(ed2, id);
    let v = await m.getForEditor(admin, id);
    await m.addFeedback(ed1, id, "Please source the claim in Part I.");
    await m.addNote(ed2, id, "INTERNAL: author may be overclaiming.");
    await m.decide(admin, id, v.manuscript.version, "request_changes", "See the editors' comments.");

    const forAuthor = await m.getForAuthor(author, id);
    expect(forAuthor.manuscript.status).toBe("changes_requested");
    expect(JSON.stringify(forAuthor)).not.toContain("INTERNAL");
    expect(forAuthor.feedback.map((f) => f.body)).toContain("Please source the claim in Part I.");

    const saved = await m.saveDraft(author, id, forAuthor.manuscript.version, { bodyMd: `${sampleBody}\n\nSourced now.` });
    await m.submit(author, id, saved.version, confirmations);
    expect((await m.getForAuthor(author, id)).manuscript.status).toBe("resubmitted");

    v = await m.getForEditor(admin, id);
    expect(v.revisions).toHaveLength(2);
    await expectCode(m.decide(admin, id, v.manuscript.version, "accept", ""), 409, "reviews_required"); // old recommendations don't count
    await m.recommend(ed1, id, v.manuscript.currentRevisionId!, "accept", "");
    await m.recommend(ed2, id, v.manuscript.currentRevisionId!, "accept", "");
    v = await m.getForEditor(admin, id);
    await m.decide(admin, id, v.manuscript.version, "accept", "");

    const mails = await getDb().select().from(s.emailJobs).where(eq(s.emailJobs.toEmail, author.email));
    expect(mails.map((j) => j.kind)).toEqual(expect.arrayContaining(["decision_request_changes", "decision_accept"]));
    expect(mails.every((j) => !j.textBody.includes("INTERNAL"))).toBe(true);
  });

  it("returns a conflict for a stale decision and refuses invalid transitions", async () => {
    const author = await actor();
    const [ed1, ed2, admin, admin2] = [await actor("editor"), await actor("editor"), await actor("admin"), await actor("admin")];
    const id = await draftAndSubmit(author);
    await m.claim(ed1, id);
    await m.claim(ed2, id);
    const v = await m.getForEditor(admin, id);
    await m.recommend(ed1, id, v.manuscript.currentRevisionId!, "accept", "");
    await m.recommend(ed2, id, v.manuscript.currentRevisionId!, "accept", "");
    const staleVersion = (await m.getForEditor(admin, id)).manuscript.version;
    await m.decide(admin2, id, staleVersion, "decline", "No.");
    await expectCode(m.decide(admin, id, staleVersion, "accept", ""), 409, "stale");
    const now = await m.getForEditor(admin, id);
    await expectCode(m.decide(admin, id, now.manuscript.version, "accept", ""), 409, "invalid_transition");
    await m.decide(admin, id, now.manuscript.version, "reopen", "Reconsidering.");
    expect((await m.getForEditor(admin, id)).manuscript.status).toBe("in_review");
  });

  it("records editorial edits as new revisions with their author, without changing the reviewed revision", async () => {
    const author = await actor();
    const ed = await actor("editor");
    const id = await draftAndSubmit(author);
    await m.claim(ed, id);
    const v = await m.getForEditor(ed, id);
    const reviewed = v.manuscript.currentRevisionId;
    const latestSeq = Math.max(...v.revisions.map((r) => r.seq));
    await m.editorEdit(ed, id, reviewed!, latestSeq, { title: v.revisions[0].title, deck: "Copyedited deck", abstract: "", bodyMd: `${sampleBody}\n\nCopyedited.`, authorBio: "Student.", note: "Fixed citation form." });
    await expectCode(
      m.editorEdit(ed, id, reviewed!, latestSeq, { title: "x", deck: "", abstract: "", bodyMd: "y", authorBio: "", note: "" }),
      409,
      "stale",
    );
    const after = await m.getForEditor(ed, id);
    expect(after.manuscript.currentRevisionId).toBe(reviewed);
    const edit = after.revisions.find((r) => r.source === "editor_edit")!;
    expect(edit.createdBy).toBe(ed.userId);
  });
});

describe("S5: publication snapshots", () => {
  async function accepted() {
    const author = await actor();
    const [ed1, ed2, admin] = [await actor("editor"), await actor("editor"), await actor("admin")];
    const id = await draftAndSubmit(author);
    await reviewToAcceptance(id, ed1, ed2, admin);
    return { author, ed1, ed2, admin, id };
  }

  it("keeps acceptance and publication separate; editors cannot publish", async () => {
    const { ed1, admin, id } = await accepted();
    expect(await listLive()).toHaveLength(0);
    const v = await m.getForEditor(admin, id);
    await expectCode(m.publish(ed1, id, { revisionId: v.manuscript.currentRevisionId!, slug: "on-parking", byline: "A. Student" }), 403);
    await m.publish(admin, id, { revisionId: v.manuscript.currentRevisionId!, slug: "on-parking", byline: "A. Student" });
    const live = await getLiveArticle("on-parking");
    expect(live?.title).toBe("On Parking Appeals");
    expect(live?.bodyHtml).toContain('<section class="notes"');
  });

  it("refuses to publish with open checks, a bad slug, a duplicate slug, or another manuscript's revision", async () => {
    const { admin, id } = await accepted();
    const other = await accepted();
    const v = await m.getForEditor(admin, id);
    const check = await m.addCheck(admin, id, "Citations verified");
    await expectCode(m.publish(admin, id, { revisionId: v.manuscript.currentRevisionId!, slug: "x-piece", byline: "A" }), 409, "checks_open");
    await m.setCheck(admin, check.id, true);
    await expectCode(m.publish(admin, id, { revisionId: v.manuscript.currentRevisionId!, slug: "Bad Slug!", byline: "A" }), 422);
    const ov = await m.getForEditor(other.admin, other.id);
    await expectCode(m.publish(admin, id, { revisionId: ov.manuscript.currentRevisionId!, slug: "x-piece", byline: "A" }), 422);
    await m.publish(admin, id, { revisionId: v.manuscript.currentRevisionId!, slug: "x-piece", byline: "A" });
    await expectCode(m.publish(other.admin, other.id, { revisionId: ov.manuscript.currentRevisionId!, slug: "x-piece", byline: "B" }), 409, "slug_taken");
  });

  it("does not change what readers see when editors edit after publication; republish creates a new version and rollback restores the old", async () => {
    const { ed1, admin, id } = await accepted();
    let v = await m.getForEditor(admin, id);
    await m.publish(admin, id, { revisionId: v.manuscript.currentRevisionId!, slug: "piece", byline: "A. Student" });
    const firstHtml = (await getLiveArticle("piece"))!.bodyHtml;

    v = await m.getForEditor(ed1, id);
    const latest = Math.max(...v.revisions.map((r) => r.seq));
    await m.editorEdit(ed1, id, v.manuscript.currentRevisionId!, latest, { title: "On Parking Appeals", deck: "A deck", abstract: "", bodyMd: "Corrected text.", authorBio: "", note: "Correction" });
    expect((await getLiveArticle("piece"))!.bodyHtml).toBe(firstHtml);

    v = await m.getForEditor(admin, id);
    const edit = v.revisions.find((r) => r.source === "editor_edit")!;
    await m.publish(admin, id, { revisionId: edit.id, slug: "piece", byline: "A. Student" });
    expect((await getLiveArticle("piece"))!.bodyHtml).toContain("Corrected text.");

    v = await m.getForEditor(admin, id);
    const original = v.publication!.versions.find((x) => x.revisionId !== edit.id)!;
    await m.restoreVersion(admin, id, original.id);
    expect((await getLiveArticle("piece"))!.bodyHtml).toBe(firstHtml);
  });

  it("unpublishing removes the piece from every public route and index", async () => {
    const { admin, id } = await accepted();
    const [vol] = await getDb().insert(s.volumes).values({ number: 9, label: "Volume IX" }).returning();
    const [issue] = await getDb().insert(s.issues).values({ volumeId: vol.id, number: 1, termLabel: "Fall", visible: true }).returning();
    const v = await m.getForEditor(admin, id);
    await m.publish(admin, id, { revisionId: v.manuscript.currentRevisionId!, slug: "gone-soon", byline: "A", issueId: issue.id });
    expect((await listVisibleIssues())[0].pieces).toHaveLength(1);
    await m.unpublish(admin, id);
    expect(await getLiveArticle("gone-soon")).toBeNull();
    expect(await listLive()).toHaveLength(0);
    expect((await listVisibleIssues())[0].pieces).toHaveLength(0);
    expect((await m.getForEditor(admin, id)).manuscript.status).toBe("accepted");
    const pubs = await getDb().select().from(s.publicationVersions);
    expect(pubs.length).toBe(1); // history kept
  });

  it("refuses to publish a manuscript that was never accepted", async () => {
    const author = await actor();
    const admin = await actor("admin");
    const id = await draftAndSubmit(author);
    const v = await m.getForEditor(admin, id);
    await expectCode(m.publish(admin, id, { revisionId: v.manuscript.currentRevisionId!, slug: "too-early", byline: "A" }), 409, "invalid_transition");
  });

  it("emails the author once when published", async () => {
    const { author, admin, id } = await accepted();
    const v = await m.getForEditor(admin, id);
    await m.publish(admin, id, { revisionId: v.manuscript.currentRevisionId!, slug: "mailed", byline: "A" });
    const jobs = await getDb().select().from(s.emailJobs).where(and(eq(s.emailJobs.toEmail, author.email), eq(s.emailJobs.kind, "published")));
    expect(jobs).toHaveLength(1);
  });
});

describe("security review follow-ups", () => {
  it("keeps a draft that was withdrawn before submission private to its author", async () => {
    const author = await actor();
    const [editor, admin] = [await actor("editor"), await actor("admin")];
    const { id } = await m.createDraft(author, "essay");
    await m.saveDraft(author, id, 1, { title: "Never Sent", bodyMd: "Private." });
    await m.withdraw(author, id);
    await expectCode(m.getForEditor(editor, id), 404);
    await expectCode(m.getForEditor(admin, id), 404);
    await expectCode(m.claim(editor, id), 404);
    for (const status of ["withdrawn", "all"]) {
      expect((await m.listQueue(editor, { status })).map((r) => r.id)).not.toContain(id);
    }
    // A piece withdrawn after it was submitted stays in the editorial record.
    const sent = await draftAndSubmit(author, "Sent, Then Withdrawn");
    await m.withdraw(author, sent);
    expect((await m.listQueue(editor, { status: "withdrawn" })).map((r) => r.id)).toContain(sent);
  });

  it("doesn't let an administrator act on the publication of their own work", async () => {
    const adminAuthor = await actor("admin");
    const [ed1, ed2, other] = [await actor("editor"), await actor("editor"), await actor("admin")];
    const id = await draftAndSubmit(adminAuthor, "An Administrator's Essay");
    await reviewToAcceptance(id, ed1, ed2, other);
    await expectCode(m.addCheck(adminAuthor, id, "Cite-check"), 403, "self_decision");
    const check = await m.addCheck(other, id, "Cite-check");
    await expectCode(m.setCheck(adminAuthor, check.id, true), 403, "self_decision");
    await m.setCheck(other, check.id, true);
    const v = await m.getForEditor(other, id);
    await m.publish(other, id, { revisionId: v.manuscript.currentRevisionId!, slug: "admins-essay", byline: "A. Admin" });
    await expectCode(m.unpublish(adminAuthor, id), 403, "self_decision");
    await m.unpublish(other, id);
    const versionId = (await m.getForEditor(other, id)).publication!.versions[0].id;
    await expectCode(m.restoreVersion(adminAuthor, id, versionId), 403, "self_decision");
    expect(await getLiveArticle("admins-essay")).toBeNull();
  });

  it("enforces closed submissions on the server, but still takes resubmissions", async () => {
    const author = await actor();
    const [ed1, admin] = [await actor("editor"), await actor("admin")];
    const { id: draftId } = await m.createDraft(author, "essay");
    const saved = await m.saveDraft(author, draftId, 1, { title: "Late", bodyMd: sampleBody });
    const sent = await draftAndSubmit(author, "Sent Before Closing");
    await m.claim(ed1, sent);
    const v = await m.getForEditor(admin, sent);
    await m.decide(admin, sent, v.manuscript.version, "request_changes", "Tighten Part II.");

    await updateSettings(admin, { submissions_open: false });
    await expectCode(m.createDraft(author, "essay"), 409, "submissions_closed");
    await expectCode(m.submit(author, draftId, saved.version, confirmations), 409, "submissions_closed");
    const mine = await m.getForAuthor(author, sent);
    await m.submit(author, sent, mine.manuscript.version, confirmations);
    expect((await m.getForAuthor(author, sent)).manuscript.status).toBe("resubmitted");
  });
});
