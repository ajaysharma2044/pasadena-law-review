import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { assertActive, type Actor } from "../actor";
import { audit } from "../audit";
import { getConfig } from "../config";
import { getDb, type Executor, type Tx } from "../db/client";
import {
  attachments,
  authorFeedback,
  authorProfiles,
  editorialDecisions,
  internalNotes,
  issues,
  manuscriptRevisions,
  manuscripts,
  memberships,
  publicationChecks,
  publications,
  publicationVersions,
  reviewAssignments,
  reviewRecommendations,
  user,
} from "../db/schema";
import { deliverSoon, enqueueEmail } from "../email/outbox";
import { templates } from "../email/templates";
import { AppError, conflict, forbidden, invalid, notFound } from "../errors";
import { renderMarkdown } from "../render/markdown";
import { isUniqueViolation } from "./applications";
import { getSetting, getSettings } from "./settings";

export type Kind = "essay" | "proposal" | "note" | "forum";
export type Status = (typeof manuscripts.$inferSelect)["status"];
const KINDS: Kind[] = ["essay", "proposal", "note", "forum"];
const KIND_WORD: Record<Kind, string> = { essay: "essay", proposal: "proposal", note: "note", forum: "Forum piece" };

const EDITABLE_BY_AUTHOR: Status[] = ["draft", "changes_requested"];
const WITHDRAWABLE: Status[] = ["draft", "submitted", "in_review", "changes_requested", "resubmitted", "accepted"];
const UNDER_REVIEW: Status[] = ["submitted", "in_review", "resubmitted"];
const EDITOR_EDITABLE: Status[] = ["in_review", "resubmitted", "accepted", "published"];
export const QUEUE_STATUSES: Status[] = ["submitted", "in_review", "resubmitted", "changes_requested", "accepted"];

const LIMITS = { title: 300, deck: 500, abstract: 3000, bodyMd: 200_000, authorBio: 1200, disclosure: 2000 };
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const stale = () => conflict("stale", "Someone changed this since you opened it. Reload to see the changes, then try again.");
const badTransition = () => conflict("invalid_transition", "That action isn’t available at this stage.");
const appUrl = () => getConfig().appUrl;
const isEditorRole = (a: Actor) => a.role === "editor" || a.role === "admin";

function clip(input: Record<string, unknown>, key: keyof typeof LIMITS) {
  const v = input[key];
  if (v === undefined) return undefined;
  const s = String(v ?? "");
  if (s.length > LIMITS[key]) throw invalid(`The ${key === "bodyMd" ? "body" : key} is too long.`, { [key]: "too_long" });
  return s;
}

async function loadForUpdate(tx: Tx, id: string) {
  const [row] = await tx.select().from(manuscripts).where(eq(manuscripts.id, id)).for("update");
  if (!row) throw notFound();
  return row;
}

async function nextSeq(tx: Executor, manuscriptId: string) {
  const [r] = await tx
    .select({ max: sql<number>`coalesce(max(${manuscriptRevisions.seq}), 0)::int` })
    .from(manuscriptRevisions)
    .where(eq(manuscriptRevisions.manuscriptId, manuscriptId));
  return (r?.max ?? 0) + 1;
}

async function setStatus(tx: Tx, id: string, from: Status[], to: Status, expectedVersion?: number) {
  const conds = [eq(manuscripts.id, id), inArray(manuscripts.status, from)];
  if (expectedVersion !== undefined) conds.push(eq(manuscripts.version, expectedVersion));
  const rows = await tx
    .update(manuscripts)
    .set({ status: to, version: sql`${manuscripts.version} + 1`, updatedAt: new Date() })
    .where(and(...conds))
    .returning({ version: manuscripts.version });
  return rows[0] ?? null;
}

async function publicationName() {
  return (await getSettings()).publication_name;
}

// ---------------------------------------------------------------- author

const submissionsClosed = () => conflict("submissions_closed", "Submissions are closed right now.");

export async function createDraft(actor: Actor, kind: string) {
  assertActive(actor);
  if (!KINDS.includes(kind as Kind)) throw invalid("Choose Essay, Proposal, Note or Forum.", { kind: "invalid" });
  const db = getDb();
  if (!(await getSetting("submissions_open", db))) throw submissionsClosed();
  const [row] = await db.insert(manuscripts).values({ authorId: actor.userId, kind: kind as Kind }).returning({ id: manuscripts.id });
  await audit(db, { actorId: actor.userId, action: "manuscript.create", targetType: "manuscript", targetId: row.id });
  return { id: row.id };
}

export async function saveDraft(
  actor: Actor,
  id: string,
  expectedVersion: number,
  input: Partial<{ title: string; deck: string; abstract: string; bodyMd: string; authorBio: string; disclosure: string; kind: string }>,
) {
  assertActive(actor);
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const v = clip(input as Record<string, unknown>, k);
    if (v !== undefined) patch[k] = v;
  }
  if (input.kind !== undefined) {
    if (!KINDS.includes(input.kind as Kind)) throw invalid("Choose Essay, Proposal, Note or Forum.", { kind: "invalid" });
    patch.kind = input.kind;
  }
  const db = getDb();
  const rows = await db
    .update(manuscripts)
    .set({ ...patch, version: sql`${manuscripts.version} + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(manuscripts.id, id),
        eq(manuscripts.authorId, actor.userId),
        eq(manuscripts.version, expectedVersion),
        inArray(manuscripts.status, EDITABLE_BY_AUTHOR),
      ),
    )
    .returning({ version: manuscripts.version });
  if (rows[0]) return { version: rows[0].version };
  const [cur] = await db.select().from(manuscripts).where(eq(manuscripts.id, id));
  if (!cur || cur.authorId !== actor.userId) throw notFound();
  if (!EDITABLE_BY_AUTHOR.includes(cur.status)) throw badTransition();
  throw stale();
}

export async function submit(actor: Actor, id: string, expectedVersion: number, c: { authorship: boolean; sources: boolean; disclosure: boolean }) {
  assertActive(actor);
  const db = getDb();
  const pub = await publicationName();
  const outcome = await db.transaction(async (tx) => {
    const m = await loadForUpdate(tx, id);
    if (m.authorId !== actor.userId) throw notFound();
    if (!EDITABLE_BY_AUTHOR.includes(m.status)) throw badTransition();
    if (m.version !== expectedVersion) throw stale();
    // Closing submissions stops new pieces; revisions the editors asked for still come in.
    if (m.status === "draft" && !(await getSetting("submissions_open", tx))) throw submissionsClosed();
    const missing: Record<string, string> = {};
    if (!m.title.trim()) missing.title = "required";
    if (!m.bodyMd.trim()) missing.bodyMd = "required";
    if (Object.keys(missing).length) throw invalid("Add a title and the text before submitting.", missing);
    if (!c.authorship || !c.sources || !c.disclosure) {
      throw invalid("Confirm all three statements before submitting.", { confirmations: "required" });
    }
    const resubmission = m.status === "changes_requested";
    const seq = await nextSeq(tx, id);
    const [rev] = await tx
      .insert(manuscriptRevisions)
      .values({
        manuscriptId: id,
        seq,
        source: "author_submission",
        kind: m.kind,
        title: m.title,
        deck: m.deck,
        abstract: m.abstract,
        bodyMd: m.bodyMd,
        authorBio: m.authorBio,
        disclosure: m.disclosure,
        createdBy: actor.userId,
        note: resubmission ? "Resubmission" : "Submission",
      })
      .returning({ id: manuscriptRevisions.id });
    await tx
      .update(manuscripts)
      .set({
        status: resubmission ? "resubmitted" : "submitted",
        currentRevisionId: rev.id,
        submittedAt: new Date(),
        version: sql`${manuscripts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(manuscripts.id, id));
    await audit(tx, { actorId: actor.userId, action: resubmission ? "manuscript.resubmit" : "manuscript.submit", targetType: "manuscript", targetId: id, metadata: { revision: seq } });

    const receipt = templates.submissionReceived(pub, actor.name, m.title, `${appUrl()}/manuscripts/${id}`);
    await enqueueEmail(tx, { kind: "submission_received", to: actor.email, toUserId: actor.userId, ...receipt, idempotencyKey: `submission:${rev.id}:receipt` });

    const recipients = resubmission
      ? await tx
          .select({ id: user.id, email: user.email })
          .from(reviewAssignments)
          .innerJoin(user, eq(user.id, reviewAssignments.editorId))
          .innerJoin(memberships, eq(memberships.userId, user.id))
          .where(and(eq(reviewAssignments.manuscriptId, id), eq(reviewAssignments.active, true), eq(memberships.status, "active")))
      : await tx
          .select({ id: user.id, email: user.email })
          .from(memberships)
          .innerJoin(user, eq(user.id, memberships.userId))
          .where(and(inArray(memberships.role, ["editor", "admin"]), eq(memberships.status, "active"), ne(user.id, actor.userId)));
    const note = templates.newSubmissionForEditors(pub, m.title, resubmission ? `revised ${KIND_WORD[m.kind]}` : KIND_WORD[m.kind], `${appUrl()}/editor/manuscripts/${id}`);
    for (const r of recipients) {
      await enqueueEmail(tx, { kind: "new_submission", to: r.email, toUserId: r.id, ...note, idempotencyKey: `submission:${rev.id}:editor:${r.id}` });
    }
    return { revisionId: rev.id };
  });
  await deliverSoon();
  return outcome;
}

export async function withdraw(actor: Actor, id: string) {
  assertActive(actor);
  const db = getDb();
  await db.transaction(async (tx) => {
    const m = await loadForUpdate(tx, id);
    if (m.authorId !== actor.userId) throw notFound();
    if (!(await setStatus(tx, id, WITHDRAWABLE, "withdrawn"))) throw badTransition();
    await tx.update(reviewAssignments).set({ active: false, releasedAt: new Date() }).where(and(eq(reviewAssignments.manuscriptId, id), eq(reviewAssignments.active, true)));
    await audit(tx, { actorId: actor.userId, action: "manuscript.withdraw", targetType: "manuscript", targetId: id, metadata: { from: m.status } });
  });
}

/** What the author may see: never recommendations, rationales or internal notes. */
export async function getForAuthor(actor: Actor, id: string) {
  assertActive(actor);
  const db = getDb();
  const [m] = await db.select().from(manuscripts).where(eq(manuscripts.id, id));
  if (!m || m.authorId !== actor.userId) throw notFound();
  const [revisions, feedback, decisions, files, pub] = await Promise.all([
    db
      .select({ id: manuscriptRevisions.id, seq: manuscriptRevisions.seq, source: manuscriptRevisions.source, title: manuscriptRevisions.title, bodyMd: manuscriptRevisions.bodyMd, note: manuscriptRevisions.note, createdAt: manuscriptRevisions.createdAt })
      .from(manuscriptRevisions)
      .where(eq(manuscriptRevisions.manuscriptId, id))
      .orderBy(asc(manuscriptRevisions.seq)),
    db.select({ id: authorFeedback.id, body: authorFeedback.body, createdAt: authorFeedback.createdAt }).from(authorFeedback).where(eq(authorFeedback.manuscriptId, id)).orderBy(asc(authorFeedback.createdAt)),
    db.select({ id: editorialDecisions.id, decision: editorialDecisions.decision, authorNote: editorialDecisions.authorNote, createdAt: editorialDecisions.createdAt }).from(editorialDecisions).where(eq(editorialDecisions.manuscriptId, id)).orderBy(asc(editorialDecisions.createdAt)),
    db.select({ id: attachments.id, filename: attachments.filename, sizeBytes: attachments.sizeBytes, createdAt: attachments.createdAt }).from(attachments).where(and(eq(attachments.manuscriptId, id), isNull(attachments.deletedAt))),
    db.select({ slug: publications.slug, state: publications.state }).from(publications).where(eq(publications.manuscriptId, id)),
  ]);
  return { manuscript: m, revisions, feedback, decisions, attachments: files, publication: pub[0] ?? null };
}

export async function listMine(actor: Actor) {
  return getDb()
    .select({ id: manuscripts.id, title: manuscripts.title, kind: manuscripts.kind, status: manuscripts.status, updatedAt: manuscripts.updatedAt })
    .from(manuscripts)
    .where(eq(manuscripts.authorId, actor.userId))
    .orderBy(desc(manuscripts.updatedAt));
}

// ---------------------------------------------------------------- editors

function assertEditorFor(actor: Actor, m: { authorId: string | null; status: Status; currentRevisionId: string | null }) {
  assertActive(actor);
  if (!isEditorRole(actor)) throw forbidden();
  // Drafts, including drafts withdrawn before they were ever submitted, are private to their authors.
  if (m.status === "draft" || !m.currentRevisionId) throw notFound();
  if (m.authorId === actor.userId) throw forbidden("self_review", "You can’t review your own work.");
}

export async function getForEditor(actor: Actor, id: string) {
  assertActive(actor);
  if (!isEditorRole(actor)) throw forbidden();
  const db = getDb();
  const [m] = await db.select().from(manuscripts).where(eq(manuscripts.id, id));
  if (!m) throw notFound();
  assertEditorFor(actor, m);
  const [author, revisions, files, assignments, recs, feedback, notes, decisions, checks, pubRows] = await Promise.all([
    m.authorId
      ? db.select({ name: user.name, email: user.email, displayName: authorProfiles.displayName }).from(user).leftJoin(authorProfiles, eq(authorProfiles.userId, user.id)).where(eq(user.id, m.authorId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db.select().from(manuscriptRevisions).where(eq(manuscriptRevisions.manuscriptId, id)).orderBy(asc(manuscriptRevisions.seq)),
    db.select().from(attachments).where(and(eq(attachments.manuscriptId, id), isNull(attachments.deletedAt))),
    db
      .select({ id: reviewAssignments.id, editorId: reviewAssignments.editorId, active: reviewAssignments.active, createdAt: reviewAssignments.createdAt, name: user.name })
      .from(reviewAssignments)
      .innerJoin(user, eq(user.id, reviewAssignments.editorId))
      .where(eq(reviewAssignments.manuscriptId, id))
      .orderBy(asc(reviewAssignments.createdAt)),
    db
      .select({ id: reviewRecommendations.id, revisionId: reviewRecommendations.revisionId, editorId: reviewRecommendations.editorId, recommendation: reviewRecommendations.recommendation, rationale: reviewRecommendations.rationale, createdAt: reviewRecommendations.createdAt, name: user.name })
      .from(reviewRecommendations)
      .innerJoin(user, eq(user.id, reviewRecommendations.editorId))
      .where(eq(reviewRecommendations.manuscriptId, id))
      .orderBy(asc(reviewRecommendations.createdAt)),
    db.select({ id: authorFeedback.id, body: authorFeedback.body, createdAt: authorFeedback.createdAt, createdBy: authorFeedback.createdBy, name: user.name }).from(authorFeedback).leftJoin(user, eq(user.id, authorFeedback.createdBy)).where(eq(authorFeedback.manuscriptId, id)).orderBy(asc(authorFeedback.createdAt)),
    db.select({ id: internalNotes.id, body: internalNotes.body, createdAt: internalNotes.createdAt, name: user.name }).from(internalNotes).leftJoin(user, eq(user.id, internalNotes.createdBy)).where(eq(internalNotes.manuscriptId, id)).orderBy(asc(internalNotes.createdAt)),
    db.select({ id: editorialDecisions.id, decision: editorialDecisions.decision, authorNote: editorialDecisions.authorNote, createdAt: editorialDecisions.createdAt, name: user.name }).from(editorialDecisions).leftJoin(user, eq(user.id, editorialDecisions.decidedBy)).where(eq(editorialDecisions.manuscriptId, id)).orderBy(asc(editorialDecisions.createdAt)),
    db.select().from(publicationChecks).where(eq(publicationChecks.manuscriptId, id)).orderBy(asc(publicationChecks.createdAt)),
    db.select().from(publications).where(eq(publications.manuscriptId, id)),
  ]);
  let publication: (typeof pubRows)[number] & { versions: (typeof publicationVersions.$inferSelect)[] } | null = null;
  if (pubRows[0]) {
    const versions = await db.select().from(publicationVersions).where(eq(publicationVersions.publicationId, pubRows[0].id)).orderBy(desc(publicationVersions.publishedAt));
    publication = { ...pubRows[0], versions };
  }
  const currentRecs = recs.filter((r) => r.revisionId === m.currentRevisionId);
  return { manuscript: m, author, revisions, attachments: files, assignments, recommendations: recs, currentRecs, feedback, notes, decisions, checks, publication };
}

export async function listQueue(actor: Actor, f: { kind?: string; status?: string; assignment?: string; issueId?: string } = {}) {
  assertActive(actor);
  if (!isEditorRole(actor)) throw forbidden();
  const db = getDb();
  const conds = [
    ne(manuscripts.status, "draft"),
    isNotNull(manuscripts.currentRevisionId), // never submitted: private to the author
    sql`(${manuscripts.authorId} is null or ${manuscripts.authorId} <> ${actor.userId})`,
  ];
  const statuses = f.status && f.status !== "all" ? [f.status as Status] : f.status === "all" ? undefined : QUEUE_STATUSES;
  if (statuses) conds.push(inArray(manuscripts.status, statuses));
  if (f.kind && KINDS.includes(f.kind as Kind)) conds.push(eq(manuscripts.kind, f.kind as Kind));
  if (f.assignment === "mine") {
    conds.push(sql`exists (select 1 from review_assignments ra where ra.manuscript_id = ${manuscripts.id} and ra.editor_id = ${actor.userId} and ra.active)`);
  } else if (f.assignment === "unassigned") {
    conds.push(sql`not exists (select 1 from review_assignments ra where ra.manuscript_id = ${manuscripts.id} and ra.active)`);
  }
  if (f.issueId) conds.push(sql`exists (select 1 from publications p where p.manuscript_id = ${manuscripts.id} and p.issue_id = ${f.issueId})`);
  return db
    .select({
      id: manuscripts.id,
      title: manuscripts.title,
      kind: manuscripts.kind,
      status: manuscripts.status,
      submittedAt: manuscripts.submittedAt,
      updatedAt: manuscripts.updatedAt,
      attributionNote: manuscripts.attributionNote,
      reviewers: sql<number>`(select count(*)::int from review_assignments ra where ra.manuscript_id = ${manuscripts.id} and ra.active)`,
      recommendations: sql<number>`(select count(distinct rr.editor_id)::int from review_recommendations rr where rr.revision_id = ${manuscripts.currentRevisionId})`,
    })
    .from(manuscripts)
    .where(and(...conds))
    .orderBy(asc(manuscripts.submittedAt));
}

async function requireAssignment(tx: Executor, manuscriptId: string, editorId: string) {
  const [a] = await tx
    .select({ id: reviewAssignments.id })
    .from(reviewAssignments)
    .where(and(eq(reviewAssignments.manuscriptId, manuscriptId), eq(reviewAssignments.editorId, editorId), eq(reviewAssignments.active, true)));
  if (!a) throw forbidden("not_assigned", "Take on the review first.");
}

async function addAssignment(tx: Tx, m: typeof manuscripts.$inferSelect, editorId: string, assignedBy: string) {
  try {
    const [row] = await tx.insert(reviewAssignments).values({ manuscriptId: m.id, editorId, assignedBy }).returning({ id: reviewAssignments.id });
    if (m.status === "submitted" || m.status === "resubmitted") await setStatus(tx, m.id, [m.status], "in_review");
    return row.id;
  } catch (e) {
    if (isUniqueViolation(e)) return null; // already assigned: no-op
    throw e;
  }
}

export async function claim(actor: Actor, id: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const m = await loadForUpdate(tx, id);
    assertEditorFor(actor, m);
    if (!UNDER_REVIEW.includes(m.status) && m.status !== "in_review") throw badTransition();
    const assignmentId = await addAssignment(tx, m, actor.userId, actor.userId);
    if (assignmentId) await audit(tx, { actorId: actor.userId, action: "review.claim", targetType: "manuscript", targetId: id });
  });
}

export async function assign(actor: Actor, id: string, editorId: string) {
  if (actor.role !== "admin") throw forbidden();
  const db = getDb();
  const pub = await publicationName();
  await db.transaction(async (tx) => {
    const m = await loadForUpdate(tx, id);
    assertEditorFor(actor, m);
    if (!UNDER_REVIEW.includes(m.status)) throw badTransition();
    if (editorId === m.authorId) throw forbidden("self_review", "An author can’t review their own work.");
    const [ed] = await tx
      .select({ id: user.id, name: user.name, email: user.email, role: memberships.role, status: memberships.status })
      .from(user)
      .innerJoin(memberships, eq(memberships.userId, user.id))
      .where(eq(user.id, editorId));
    if (!ed || ed.status !== "active" || ed.role === "member") throw invalid("Choose an active editor.", { editorId: "invalid" });
    const assignmentId = await addAssignment(tx, m, editorId, actor.userId);
    if (!assignmentId) return;
    await audit(tx, { actorId: actor.userId, action: "review.assign", targetType: "manuscript", targetId: id, metadata: { editor: editorId } });
    const t = templates.reviewAssigned(pub, ed.name, m.title, `${appUrl()}/editor/manuscripts/${id}`);
    await enqueueEmail(tx, { kind: "review_assigned", to: ed.email, toUserId: ed.id, ...t, idempotencyKey: `assignment:${assignmentId}` });
  });
  await deliverSoon();
}

export async function release(actor: Actor, assignmentId: string) {
  assertActive(actor);
  const db = getDb();
  const [a] = await db.select().from(reviewAssignments).where(eq(reviewAssignments.id, assignmentId));
  if (!a || !a.active) throw notFound();
  if (actor.role !== "admin" && a.editorId !== actor.userId) throw forbidden();
  await db.update(reviewAssignments).set({ active: false, releasedAt: new Date() }).where(eq(reviewAssignments.id, assignmentId));
  await audit(db, { actorId: actor.userId, action: "review.release", targetType: "manuscript", targetId: a.manuscriptId, metadata: { editor: a.editorId } });
  return a.manuscriptId;
}

export async function recommend(actor: Actor, id: string, revisionId: string, recommendation: string, rationale: string) {
  if (!["accept", "changes", "decline"].includes(recommendation)) throw invalid("Choose accept, changes or decline.", { recommendation: "invalid" });
  const db = getDb();
  await db.transaction(async (tx) => {
    const m = await loadForUpdate(tx, id);
    assertEditorFor(actor, m);
    await requireAssignment(tx, id, actor.userId);
    if (m.status !== "in_review" && m.status !== "resubmitted") throw badTransition();
    if (revisionId !== m.currentRevisionId) throw stale();
    try {
      await tx.insert(reviewRecommendations).values({
        manuscriptId: id,
        revisionId,
        editorId: actor.userId,
        recommendation: recommendation as "accept",
        rationale: rationale.slice(0, 8000),
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("already_recommended", "You already recommended on this version.");
      throw e;
    }
    await audit(tx, { actorId: actor.userId, action: "review.recommend", targetType: "manuscript", targetId: id, metadata: { recommendation } });
  });
}

export async function addFeedback(actor: Actor, id: string, body: string) {
  const text = body.trim();
  if (!text) throw invalid("Write a comment first.", { body: "required" });
  const db = getDb();
  await db.transaction(async (tx) => {
    const m = await loadForUpdate(tx, id);
    assertEditorFor(actor, m);
    if (actor.role !== "admin") await requireAssignment(tx, id, actor.userId);
    await tx.insert(authorFeedback).values({ manuscriptId: id, revisionId: m.currentRevisionId, body: text.slice(0, 8000), createdBy: actor.userId });
    await audit(tx, { actorId: actor.userId, action: "review.feedback", targetType: "manuscript", targetId: id });
  });
}

export async function addNote(actor: Actor, id: string, body: string) {
  const text = body.trim();
  if (!text) throw invalid("Write a note first.", { body: "required" });
  const db = getDb();
  const [m] = await db.select().from(manuscripts).where(eq(manuscripts.id, id));
  if (!m) throw notFound();
  assertEditorFor(actor, m);
  await db.insert(internalNotes).values({ manuscriptId: id, body: text.slice(0, 8000), createdBy: actor.userId });
  await audit(db, { actorId: actor.userId, action: "review.note", targetType: "manuscript", targetId: id });
}

export async function editorEdit(
  actor: Actor,
  id: string,
  baseRevisionId: string,
  expectedLatestSeq: number,
  input: { title: string; deck: string; abstract: string; bodyMd: string; authorBio: string; note: string },
) {
  const content = {
    title: clip(input, "title") ?? "",
    deck: clip(input, "deck") ?? "",
    abstract: clip(input, "abstract") ?? "",
    bodyMd: clip(input, "bodyMd") ?? "",
    authorBio: clip(input, "authorBio") ?? "",
  };
  if (!content.title.trim() || !content.bodyMd.trim()) throw invalid("An edited version needs a title and text.", { bodyMd: "required" });
  const db = getDb();
  return db.transaction(async (tx) => {
    const m = await loadForUpdate(tx, id);
    assertEditorFor(actor, m);
    if (!EDITOR_EDITABLE.includes(m.status)) throw badTransition();
    if (actor.role !== "admin") await requireAssignment(tx, id, actor.userId);
    const [base] = await tx.select().from(manuscriptRevisions).where(and(eq(manuscriptRevisions.id, baseRevisionId), eq(manuscriptRevisions.manuscriptId, id)));
    if (!base) throw invalid("That base version doesn’t belong to this manuscript.");
    const seq = await nextSeq(tx, id);
    if (seq - 1 !== expectedLatestSeq) throw stale();
    const [rev] = await tx
      .insert(manuscriptRevisions)
      .values({ manuscriptId: id, seq, source: "editor_edit", kind: m.kind, ...content, disclosure: base.disclosure, createdBy: actor.userId, note: `${input.note.trim().slice(0, 500)} (edited from version ${base.seq})`.trim() })
      .returning({ id: manuscriptRevisions.id });
    await audit(tx, { actorId: actor.userId, action: "review.edit", targetType: "manuscript", targetId: id, metadata: { revision: seq, base: base.seq } });
    return { revisionId: rev.id, seq };
  });
}

// ---------------------------------------------------------------- administrators

type Decision = "accept" | "request_changes" | "decline" | "reopen";
const DECISION_FROM: Record<Decision, Status[]> = {
  accept: ["in_review", "resubmitted"],
  request_changes: ["submitted", "in_review", "resubmitted"],
  decline: ["submitted", "in_review", "resubmitted", "changes_requested", "accepted"],
  reopen: ["declined"],
};
const DECISION_TO: Record<Decision, Status> = { accept: "accepted", request_changes: "changes_requested", decline: "declined", reopen: "in_review" };

export async function decide(actor: Actor, id: string, expectedVersion: number, decision: string, authorNote: string) {
  assertActive(actor);
  if (actor.role !== "admin") throw forbidden();
  if (!(decision in DECISION_FROM)) throw invalid("Choose a decision.", { decision: "invalid" });
  const d = decision as Decision;
  if (d === "request_changes" && !authorNote.trim()) throw invalid("Tell the author what to change.", { authorNote: "required" });
  const db = getDb();
  const pub = await publicationName();
  await db.transaction(async (tx) => {
    const m = await loadForUpdate(tx, id);
    if (m.authorId === actor.userId) throw forbidden("self_decision", "Another administrator has to decide on your own work.");
    if (m.version !== expectedVersion) throw stale();
    if (!DECISION_FROM[d].includes(m.status)) throw badTransition();
    if (d === "accept") {
      const recs = await tx
        .selectDistinct({ editorId: reviewRecommendations.editorId })
        .from(reviewRecommendations)
        .where(eq(reviewRecommendations.revisionId, m.currentRevisionId!));
      const independent = recs.filter((r) => r.editorId !== m.authorId);
      if (independent.length < 2) {
        throw new AppError(409, "reviews_required", "Two editors other than the author must recommend on the current version first.");
      }
    }
    if (!(await setStatus(tx, id, DECISION_FROM[d], DECISION_TO[d], expectedVersion))) throw stale();
    const [row] = await tx
      .insert(editorialDecisions)
      .values({ manuscriptId: id, revisionId: m.currentRevisionId, decision: d, authorNote: authorNote.trim().slice(0, 8000), decidedBy: actor.userId })
      .returning({ id: editorialDecisions.id });
    await audit(tx, { actorId: actor.userId, action: `decision.${d}`, targetType: "manuscript", targetId: id });
    if (m.authorId && d !== "reopen") {
      const [author] = await tx.select().from(user).where(eq(user.id, m.authorId));
      if (author) {
        const t = templates.decisionForAuthor(pub, author.name, m.title, d, `${appUrl()}/manuscripts/${id}`);
        await enqueueEmail(tx, { kind: `decision_${d}`, to: author.email, toUserId: author.id, ...t, idempotencyKey: `decision:${row.id}:author` });
      }
    }
  });
  await deliverSoon();
}

const ownWork = () => forbidden("self_decision", "Another administrator has to handle your own work.");

export async function addCheck(actor: Actor, id: string, label: string) {
  assertActive(actor);
  if (actor.role !== "admin") throw forbidden();
  const text = label.trim();
  if (!text) throw invalid("Describe the check.", { label: "required" });
  const db = getDb();
  const [m] = await db.select({ id: manuscripts.id, authorId: manuscripts.authorId }).from(manuscripts).where(eq(manuscripts.id, id));
  if (!m) throw notFound();
  if (m.authorId === actor.userId) throw ownWork();
  const [row] = await db.insert(publicationChecks).values({ manuscriptId: id, label: text.slice(0, 300) }).returning({ id: publicationChecks.id });
  await audit(db, { actorId: actor.userId, action: "check.add", targetType: "manuscript", targetId: id });
  return { id: row.id };
}

export async function setCheck(actor: Actor, checkId: string, resolved: boolean) {
  assertActive(actor);
  if (actor.role !== "admin") throw forbidden();
  const db = getDb();
  const [c] = await db
    .select({ authorId: manuscripts.authorId })
    .from(publicationChecks)
    .innerJoin(manuscripts, eq(manuscripts.id, publicationChecks.manuscriptId))
    .where(eq(publicationChecks.id, checkId));
  if (!c) throw notFound();
  if (c.authorId === actor.userId) throw ownWork();
  const rows = await db
    .update(publicationChecks)
    .set({ resolved, resolvedBy: resolved ? actor.userId : null, resolvedAt: resolved ? new Date() : null })
    .where(eq(publicationChecks.id, checkId))
    .returning({ manuscriptId: publicationChecks.manuscriptId });
  if (!rows[0]) throw notFound();
  await audit(db, { actorId: actor.userId, action: resolved ? "check.resolve" : "check.reopen", targetType: "manuscript", targetId: rows[0].manuscriptId, metadata: { check: checkId } });
  return rows[0].manuscriptId;
}

export async function publish(actor: Actor, id: string, opts: { revisionId: string; slug: string; byline: string; issueId?: string | null; issueOrder?: number }) {
  assertActive(actor);
  if (actor.role !== "admin") throw forbidden();
  const slug = opts.slug.trim();
  const byline = opts.byline.trim();
  if (!SLUG_RE.test(slug) || slug.length > 80) throw invalid("Use lowercase letters, numbers and single hyphens for the web address.", { slug: "invalid" });
  if (!byline) throw invalid("Add the public byline.", { byline: "required" });
  const db = getDb();
  const pub = await publicationName();
  try {
    await db.transaction(async (tx) => {
      const m = await loadForUpdate(tx, id);
      if (m.authorId === actor.userId) throw forbidden("self_decision", "Another administrator has to publish your own work.");
      if (m.status !== "accepted" && m.status !== "published") throw badTransition();
      const [rev] = await tx.select().from(manuscriptRevisions).where(and(eq(manuscriptRevisions.id, opts.revisionId), eq(manuscriptRevisions.manuscriptId, id)));
      if (!rev) throw invalid("Choose a version of this manuscript.", { revisionId: "invalid" });
      const open = await tx.select({ id: publicationChecks.id }).from(publicationChecks).where(and(eq(publicationChecks.manuscriptId, id), eq(publicationChecks.resolved, false)));
      if (open.length) throw new AppError(409, "checks_open", "Resolve every publication check before publishing.");
      if (opts.issueId) {
        const [iss] = await tx.select({ id: issues.id }).from(issues).where(eq(issues.id, opts.issueId));
        if (!iss) throw invalid("That issue doesn’t exist.", { issueId: "invalid" });
      }
      const [taken] = await tx.select({ manuscriptId: publications.manuscriptId }).from(publications).where(eq(publications.slug, slug));
      if (taken && taken.manuscriptId !== id) throw conflict("slug_taken", "Another article already uses that web address.");

      let [existing] = await tx.select().from(publications).where(eq(publications.manuscriptId, id)).for("update");
      const first = !existing;
      if (!existing) {
        [existing] = await tx.insert(publications).values({ manuscriptId: id, slug, kind: rev.kind, issueId: opts.issueId ?? null, issueOrder: opts.issueOrder ?? 0 }).returning();
      }
      const [version] = await tx
        .insert(publicationVersions)
        .values({
          publicationId: existing.id,
          revisionId: rev.id,
          title: rev.title,
          deck: rev.deck,
          abstract: rev.abstract,
          byline,
          authorBio: rev.authorBio,
          bodyHtml: renderMarkdown(rev.bodyMd),
          publishedBy: actor.userId,
        })
        .returning({ id: publicationVersions.id });
      await tx
        .update(publications)
        .set({ slug, kind: rev.kind, issueId: opts.issueId ?? null, issueOrder: opts.issueOrder ?? 0, state: "live", currentVersionId: version.id, updatedAt: new Date() })
        .where(eq(publications.id, existing.id));
      if (m.status !== "published") await setStatus(tx, id, ["accepted"], "published");
      await audit(tx, { actorId: actor.userId, action: first ? "publication.publish" : "publication.republish", targetType: "manuscript", targetId: id, metadata: { revision: rev.seq, slug } });
      if (first && m.authorId) {
        const [author] = await tx.select().from(user).where(eq(user.id, m.authorId));
        if (author) {
          const t = templates.published(pub, author.name, rev.title, `${appUrl()}/articles/${slug}`);
          await enqueueEmail(tx, { kind: "published", to: author.email, toUserId: author.id, ...t, idempotencyKey: `publication:${existing.id}:first` });
        }
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("slug_taken", "Another article already uses that web address.");
    throw e;
  }
  await deliverSoon();
}

export async function unpublish(actor: Actor, id: string) {
  assertActive(actor);
  if (actor.role !== "admin") throw forbidden();
  const db = getDb();
  await db.transaction(async (tx) => {
    const m = await loadForUpdate(tx, id);
    if (m.authorId === actor.userId) throw ownWork();
    const rows = await tx.update(publications).set({ state: "unpublished", updatedAt: new Date() }).where(and(eq(publications.manuscriptId, id), eq(publications.state, "live"))).returning({ id: publications.id });
    if (!rows.length) throw badTransition();
    await setStatus(tx, id, ["published"], "accepted");
    await audit(tx, { actorId: actor.userId, action: "publication.unpublish", targetType: "manuscript", targetId: id });
  });
}

export async function restoreVersion(actor: Actor, id: string, versionId: string) {
  assertActive(actor);
  if (actor.role !== "admin") throw forbidden();
  const db = getDb();
  await db.transaction(async (tx) => {
    const m = await loadForUpdate(tx, id);
    if (m.authorId === actor.userId) throw ownWork();
    if (m.status !== "published" && m.status !== "accepted") throw badTransition();
    const [p] = await tx.select().from(publications).where(eq(publications.manuscriptId, id)).for("update");
    if (!p) throw badTransition();
    const [v] = await tx.select({ id: publicationVersions.id }).from(publicationVersions).where(and(eq(publicationVersions.id, versionId), eq(publicationVersions.publicationId, p.id)));
    if (!v) throw invalid("That version doesn’t belong to this article.");
    await tx.update(publications).set({ currentVersionId: v.id, state: "live", updatedAt: new Date() }).where(eq(publications.id, p.id));
    if (m.status === "accepted") await setStatus(tx, id, ["accepted"], "published");
    await audit(tx, { actorId: actor.userId, action: "publication.restore", targetType: "manuscript", targetId: id, metadata: { version: versionId } });
  });
}
