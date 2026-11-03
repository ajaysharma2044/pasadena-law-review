import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  cmsPageVersions,
  issues,
  mastheadEntries,
  meetings,
  manuscripts,
  publications,
  publicationVersions,
  volumes,
} from "../db/schema";
import { renderMarkdown } from "../render/markdown";
import { getSettings } from "./settings";

/**
 * Everything readers can see. These queries only touch live publications and published
 * page versions; they never read manuscripts, revisions or drafts.
 */

export const PAGE_KEYS = ["about", "submissions", "meetings_intro", "front_note", "independence"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export async function getPublishedPage(key: PageKey): Promise<{ html: string; updatedAt: Date } | null> {
  const [row] = await getDb()
    .select({ bodyMd: cmsPageVersions.bodyMd, decidedAt: cmsPageVersions.decidedAt, createdAt: cmsPageVersions.createdAt })
    .from(cmsPageVersions)
    .where(and(eq(cmsPageVersions.pageKey, key), eq(cmsPageVersions.status, "published")));
  if (!row || !row.bodyMd.trim()) return null;
  return { html: renderMarkdown(row.bodyMd), updatedAt: row.decidedAt ?? row.createdAt };
}

const liveColumns = {
  slug: publications.slug,
  kind: publications.kind,
  issueId: publications.issueId,
  issueOrder: publications.issueOrder,
  firstPublishedAt: publications.firstPublishedAt,
  title: publicationVersions.title,
  deck: publicationVersions.deck,
  abstract: publicationVersions.abstract,
  byline: publicationVersions.byline,
  versionPublishedAt: publicationVersions.publishedAt,
};

export type LiveListing = {
  slug: string;
  kind: "essay" | "proposal" | "note" | "forum";
  issueId: string | null;
  issueOrder: number;
  firstPublishedAt: Date;
  title: string;
  deck: string;
  abstract: string;
  byline: string;
  versionPublishedAt: Date;
};

export async function listLive(opts: { kind?: LiveListing["kind"]; excludeForum?: boolean } = {}): Promise<LiveListing[]> {
  const db = getDb();
  const conds = [eq(publications.state, "live")];
  if (opts.kind) conds.push(eq(publications.kind, opts.kind));
  if (opts.excludeForum) conds.push(sql`${publications.kind} <> 'forum'`);
  return db
    .select(liveColumns)
    .from(publications)
    .innerJoin(publicationVersions, eq(publicationVersions.id, publications.currentVersionId))
    .where(and(...conds))
    .orderBy(desc(publications.firstPublishedAt));
}

export async function getLiveArticle(slug: string) {
  const db = getDb();
  const [row] = await db
    .select({
      ...liveColumns,
      authorId: manuscripts.authorId,
      authorBio: publicationVersions.authorBio,
      bodyHtml: publicationVersions.bodyHtml,
      issueNumber: issues.number,
      issueTerm: issues.termLabel,
      issueVisible: issues.visible,
      volumeLabel: volumes.label,
    })
    .from(publications)
    .innerJoin(publicationVersions, eq(publicationVersions.id, publications.currentVersionId))
    .innerJoin(manuscripts, eq(manuscripts.id, publications.manuscriptId))
    .leftJoin(issues, eq(issues.id, publications.issueId))
    .leftJoin(volumes, eq(volumes.id, issues.volumeId))
    .where(and(eq(publications.slug, slug), eq(publications.state, "live")));
  return row ?? null;
}

export async function getFrontLead(): Promise<LiveListing | null> {
  const settings = await getSettings();
  const all = await listLive({ excludeForum: true });
  if (settings.front_lead_publication_id) {
    const db = getDb();
    const [chosen] = await db
      .select({ slug: publications.slug })
      .from(publications)
      .where(and(eq(publications.id, settings.front_lead_publication_id), eq(publications.state, "live")));
    const found = chosen && all.find((p) => p.slug === chosen.slug);
    if (found) return found;
  }
  return all[0] ?? null;
}

export async function listVisibleIssues() {
  const db = getDb();
  const rows = await db
    .select({
      id: issues.id,
      number: issues.number,
      termLabel: issues.termLabel,
      sortOrder: issues.sortOrder,
      volumeNumber: volumes.number,
      volumeLabel: volumes.label,
      yearLabel: volumes.yearLabel,
    })
    .from(issues)
    .innerJoin(volumes, eq(volumes.id, issues.volumeId))
    .where(eq(issues.visible, true))
    .orderBy(desc(volumes.number), desc(issues.sortOrder), desc(issues.number));
  if (!rows.length) return [];
  const contents = await db
    .select(liveColumns)
    .from(publications)
    .innerJoin(publicationVersions, eq(publicationVersions.id, publications.currentVersionId))
    .where(and(eq(publications.state, "live"), inArray(publications.issueId, rows.map((r) => r.id))))
    .orderBy(asc(publications.issueOrder), asc(publications.firstPublishedAt));
  return rows.map((issue) => ({ ...issue, pieces: contents.filter((c) => c.issueId === issue.id) }));
}

export async function getNextMeeting(now = new Date()) {
  const db = getDb();
  const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const [row] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.status, "announced"), gte(meetings.startsAt, windowStart)))
    .orderBy(asc(meetings.startsAt))
    .limit(1);
  return row ?? null;
}

export async function listPastMinutes() {
  const db = getDb();
  const rows = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.status, "held"), eq(meetings.minutesPublished, true)))
    .orderBy(desc(meetings.startsAt));
  return rows.map((m) => ({ ...m, minutesHtml: renderMarkdown(m.minutesMd) }));
}

export async function getPublishedMasthead() {
  const settings = await getSettings();
  if (!settings.masthead_published) return null;
  const entries = await getDb().select().from(mastheadEntries).orderBy(asc(mastheadEntries.sortOrder));
  return entries.length ? entries : null;
}

export function formatMeetingTime(startsAt: Date, timezone: string) {
  const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: timezone }).format(startsAt);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone, timeZoneName: "short" }).format(startsAt);
  return `${date}, ${time}`;
}

export function formatDate(d: Date, timezone = "America/Los_Angeles") {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: timezone }).format(d);
}

export const KIND_LABEL: Record<LiveListing["kind"], string> = {
  essay: "Essay",
  proposal: "Proposal",
  note: "Note",
  forum: "Forum",
};
