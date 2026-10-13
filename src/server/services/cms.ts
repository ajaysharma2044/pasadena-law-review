import { and, asc, desc, eq, sql } from "drizzle-orm";
import { assertActive, type Actor } from "../actor";
import { audit } from "../audit";
import { getDb } from "../db/client";
import { cmsPageVersions, issues, mastheadEntries, meetings, publications, siteSettings, user, volumes } from "../db/schema";
import { conflict, forbidden, invalid, notFound } from "../errors";
import { PAGE_KEYS, type PageKey } from "./public-content";
import { SettingsSchema, type Settings } from "./settings";

const isEditorRole = (a: Actor) => a.role === "editor" || a.role === "admin";
function requireEditor(a: Actor) {
  assertActive(a);
  if (!isEditorRole(a)) throw forbidden();
}
function requireAdmin(a: Actor) {
  assertActive(a);
  if (a.role !== "admin") throw forbidden();
}
function pageKey(key: string): PageKey {
  if (!PAGE_KEYS.includes(key as PageKey)) throw notFound();
  return key as PageKey;
}

export const PAGE_LABELS: Record<PageKey, string> = {
  about: "About",
  independence: "Independence statement",
  submissions: "Submission guidelines",
  meetings_intro: "Meetings page",
  front_note: "Front-page note from the editors",
};

// ---------------------------------------------------------------- pages

/** Editors (and admins) propose a change; nothing public changes until an admin publishes it. */
export async function proposePage(actor: Actor, key: string, bodyMd: string, note: string) {
  requireEditor(actor);
  const k = pageKey(key);
  if (bodyMd.length > 50_000) throw invalid("The page is too long.", { bodyMd: "too_long" });
  const db = getDb();
  const [row] = await db
    .insert(cmsPageVersions)
    .values({ pageKey: k, bodyMd, status: "proposed", note: note.trim().slice(0, 500), createdBy: actor.userId })
    .returning({ id: cmsPageVersions.id });
  await audit(db, { actorId: actor.userId, action: "page.propose", targetType: "page", targetId: k, metadata: { version: row.id } });
  return { id: row.id };
}

export async function publishPageVersion(actor: Actor, versionId: string) {
  requireAdmin(actor);
  const db = getDb();
  await db.transaction(async (tx) => {
    const [v] = await tx.select().from(cmsPageVersions).where(eq(cmsPageVersions.id, versionId)).for("update");
    if (!v) throw notFound();
    if (v.status !== "proposed" && v.status !== "draft") throw conflict("already_decided", "That version has already been decided.");
    await tx
      .update(cmsPageVersions)
      .set({ status: "superseded" })
      .where(and(eq(cmsPageVersions.pageKey, v.pageKey), eq(cmsPageVersions.status, "published")));
    await tx.update(cmsPageVersions).set({ status: "published", decidedBy: actor.userId, decidedAt: new Date() }).where(eq(cmsPageVersions.id, versionId));
    await audit(tx, { actorId: actor.userId, action: "page.publish", targetType: "page", targetId: v.pageKey, metadata: { version: versionId } });
  });
}

/** Administrator edits go through the same versioned path: a proposal published at once, audited. */
export async function publishPageDirect(actor: Actor, key: string, bodyMd: string, note: string) {
  requireAdmin(actor);
  const { id } = await proposePage(actor, key, bodyMd, note || "Edited by an administrator");
  await publishPageVersion(actor, id);
  return { id };
}

export async function rejectPageVersion(actor: Actor, versionId: string) {
  requireAdmin(actor);
  const db = getDb();
  const rows = await db
    .update(cmsPageVersions)
    .set({ status: "rejected", decidedBy: actor.userId, decidedAt: new Date() })
    .where(and(eq(cmsPageVersions.id, versionId), eq(cmsPageVersions.status, "proposed")))
    .returning({ key: cmsPageVersions.pageKey });
  if (!rows[0]) throw notFound();
  await audit(db, { actorId: actor.userId, action: "page.reject", targetType: "page", targetId: rows[0].key, metadata: { version: versionId } });
}

export async function pageVersions(key: string) {
  const k = pageKey(key);
  return getDb()
    .select({ id: cmsPageVersions.id, status: cmsPageVersions.status, bodyMd: cmsPageVersions.bodyMd, note: cmsPageVersions.note, createdAt: cmsPageVersions.createdAt, decidedAt: cmsPageVersions.decidedAt, author: user.name })
    .from(cmsPageVersions)
    .leftJoin(user, eq(user.id, cmsPageVersions.createdBy))
    .where(eq(cmsPageVersions.pageKey, k))
    .orderBy(desc(cmsPageVersions.createdAt))
    .limit(30);
}

export async function pagesOverview() {
  const rows = await getDb()
    .select({ key: cmsPageVersions.pageKey, status: cmsPageVersions.status, n: sql<number>`count(*)::int` })
    .from(cmsPageVersions)
    .groupBy(cmsPageVersions.pageKey, cmsPageVersions.status);
  return PAGE_KEYS.map((k) => ({
    key: k,
    label: PAGE_LABELS[k],
    published: rows.some((r) => r.key === k && r.status === "published"),
    proposed: rows.find((r) => r.key === k && r.status === "proposed")?.n ?? 0,
  }));
}

// ---------------------------------------------------------------- meetings

export type MeetingInput = {
  status: string;
  startsAtLocal: string; // "2026-10-20T18:30" in the meeting's own timezone
  timezone: string;
  location: string;
  motion: string;
  openerFor: string;
  openerAgainst: string;
  attendancePolicy: string;
  minutesMd: string;
  minutesPublished: boolean;
};

const MEETING_STATUSES = ["draft", "announced", "held", "cancelled"] as const;

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Converts a wall-clock time in an IANA zone to a UTC instant (no external libraries). */
export function zonedToUtc(local: string, timeZone: string): Date {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) throw invalid("Enter the date and time.", { startsAtLocal: "invalid" });
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (t: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(t))
        .map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return asUtc - t;
  };
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
}

export function utcToLocalInput(d: Date | null, timeZone: string) {
  if (!d) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * Editors may create and edit draft meetings (including minutes text). Announcing, marking held,
 * cancelling, publishing minutes, or editing a meeting that is already public needs an administrator.
 */
export async function saveMeeting(actor: Actor, id: string | null, expectedVersion: number | null, input: MeetingInput) {
  requireEditor(actor);
  if (!MEETING_STATUSES.includes(input.status as (typeof MEETING_STATUSES)[number])) throw invalid("Choose a status.", { status: "invalid" });
  if (!isValidTimeZone(input.timezone)) throw invalid("Choose a valid time zone.", { timezone: "invalid" });
  const startsAt = input.startsAtLocal ? zonedToUtc(input.startsAtLocal, input.timezone) : null;
  if (input.status !== "draft" && !startsAt) throw invalid("An announced meeting needs a date and time.", { startsAtLocal: "required" });
  const isAdmin = actor.role === "admin";
  if (!isAdmin && (input.status !== "draft" || input.minutesPublished)) {
    throw forbidden("forbidden", "Only an administrator can announce a meeting or publish minutes.");
  }
  const values = {
    status: input.status as (typeof MEETING_STATUSES)[number],
    startsAt,
    timezone: input.timezone,
    location: input.location.trim().slice(0, 300),
    motion: input.motion.trim().slice(0, 1000),
    openerFor: input.openerFor.trim().slice(0, 200),
    openerAgainst: input.openerAgainst.trim().slice(0, 200),
    attendancePolicy: input.attendancePolicy.trim().slice(0, 300),
    minutesMd: input.minutesMd.slice(0, 50_000),
    minutesPublished: input.minutesPublished,
    updatedBy: actor.userId,
    updatedAt: new Date(),
  };
  const db = getDb();
  if (!id) {
    const [row] = await db.insert(meetings).values(values).returning({ id: meetings.id });
    await audit(db, { actorId: actor.userId, action: "meeting.create", targetType: "meeting", targetId: row.id, metadata: { status: values.status } });
    return { id: row.id };
  }
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(meetings).where(eq(meetings.id, id)).for("update");
    if (!cur) throw notFound();
    if (!isAdmin && (cur.status !== "draft" || cur.minutesPublished)) throw forbidden("forbidden", "Only an administrator can change a public meeting.");
    if (expectedVersion !== null && cur.version !== expectedVersion) throw conflict("stale", "Someone changed this meeting since you opened it.");
    await tx.update(meetings).set({ ...values, version: sql`${meetings.version} + 1` }).where(eq(meetings.id, id));
    await audit(tx, { actorId: actor.userId, action: "meeting.update", targetType: "meeting", targetId: id, metadata: { status: values.status, minutesPublished: values.minutesPublished } });
  });
  return { id };
}

export async function listMeetings() {
  return getDb().select().from(meetings).orderBy(desc(meetings.createdAt));
}

export async function getMeeting(id: string) {
  const [m] = await getDb().select().from(meetings).where(eq(meetings.id, id));
  return m ?? null;
}

// ---------------------------------------------------------------- volumes and issues

export async function createVolume(actor: Actor, number: number, label: string, yearLabel: string) {
  requireAdmin(actor);
  if (!Number.isInteger(number) || number < 1) throw invalid("Volume number must be a positive whole number.");
  const db = getDb();
  const [row] = await db.insert(volumes).values({ number, label: label.trim() || `Volume ${number}`, yearLabel: yearLabel.trim() }).returning({ id: volumes.id });
  await audit(db, { actorId: actor.userId, action: "volume.create", targetType: "volume", targetId: row.id });
  return row;
}

export async function saveIssue(actor: Actor, input: { id?: string; volumeId: string; number: number; termLabel: string; visible: boolean; sortOrder: number }) {
  requireAdmin(actor);
  if (!Number.isInteger(input.number) || input.number < 1) throw invalid("Issue number must be a positive whole number.");
  if (!input.termLabel.trim()) throw invalid("Add the term, e.g. Fall 2026.", { termLabel: "required" });
  const db = getDb();
  if (input.id) {
    const rows = await db
      .update(issues)
      .set({ number: input.number, termLabel: input.termLabel.trim(), visible: input.visible, sortOrder: input.sortOrder })
      .where(eq(issues.id, input.id))
      .returning({ id: issues.id });
    if (!rows[0]) throw notFound();
    await audit(db, { actorId: actor.userId, action: "issue.update", targetType: "issue", targetId: input.id, metadata: { visible: input.visible } });
    return rows[0];
  }
  const [row] = await db
    .insert(issues)
    .values({ volumeId: input.volumeId, number: input.number, termLabel: input.termLabel.trim(), visible: input.visible, sortOrder: input.sortOrder })
    .returning({ id: issues.id });
  await audit(db, { actorId: actor.userId, action: "issue.create", targetType: "issue", targetId: row.id });
  return row;
}

export async function listIssuesAdmin() {
  const db = getDb();
  const rows = await db
    .select({ id: issues.id, number: issues.number, termLabel: issues.termLabel, visible: issues.visible, sortOrder: issues.sortOrder, volumeId: volumes.id, volumeLabel: volumes.label, volumeNumber: volumes.number, yearLabel: volumes.yearLabel })
    .from(issues)
    .innerJoin(volumes, eq(volumes.id, issues.volumeId))
    .orderBy(desc(volumes.number), asc(issues.number));
  const counts = await db.select({ issueId: publications.issueId, n: sql<number>`count(*)::int` }).from(publications).where(eq(publications.state, "live")).groupBy(publications.issueId);
  return rows.map((r) => ({ ...r, livePieces: counts.find((c) => c.issueId === r.id)?.n ?? 0 }));
}

export async function listVolumes() {
  return getDb().select().from(volumes).orderBy(desc(volumes.number));
}

// ---------------------------------------------------------------- settings and masthead

export async function updateSettings(actor: Actor, patch: Partial<Settings>) {
  requireAdmin(actor);
  const parsed = SettingsSchema.partial().safeParse(patch);
  if (!parsed.success) throw invalid("Some settings aren’t valid.", Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), "invalid"])));
  const data = parsed.data;
  if (data.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_email)) throw invalid("Enter a valid contact email.", { contact_email: "invalid" });
  if (data.timezone && !isValidTimeZone(data.timezone)) throw invalid("Choose a valid time zone.", { timezone: "invalid" });
  if (data.front_lead_publication_id) {
    const [p] = await getDb().select({ id: publications.id }).from(publications).where(eq(publications.id, data.front_lead_publication_id));
    if (!p) throw invalid("Choose a published article for the front page.", { front_lead_publication_id: "invalid" });
  }
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(data)) {
      await tx
        .insert(siteSettings)
        .values({ key, value: value as never, updatedBy: actor.userId })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value: value as never, updatedBy: actor.userId, updatedAt: new Date() } });
    }
    await audit(tx, { actorId: actor.userId, action: "settings.update", targetType: "settings", targetId: "site", metadata: { keys: Object.keys(data).join(",") } });
  });
}

export async function saveMasthead(actor: Actor, entries: { roleTitle: string; personName: string }[], publish: boolean) {
  requireAdmin(actor);
  const clean = entries
    .map((e) => ({ roleTitle: e.roleTitle.trim().slice(0, 120), personName: e.personName.trim().slice(0, 120) }))
    .filter((e) => e.roleTitle && e.personName);
  if (publish && clean.length === 0) throw invalid("Add at least one real name before publishing the masthead.");
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(mastheadEntries);
    if (clean.length) await tx.insert(mastheadEntries).values(clean.map((e, i) => ({ ...e, sortOrder: i })));
    await tx
      .insert(siteSettings)
      .values({ key: "masthead_published", value: publish as never, updatedBy: actor.userId })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: publish as never, updatedBy: actor.userId, updatedAt: new Date() } });
    await audit(tx, { actorId: actor.userId, action: "masthead.save", targetType: "settings", targetId: "masthead", metadata: { entries: clean.length, published: publish } });
  });
}

export async function listMastheadAdmin() {
  return getDb().select().from(mastheadEntries).orderBy(asc(mastheadEntries.sortOrder));
}
