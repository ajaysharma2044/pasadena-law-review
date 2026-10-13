import { and, count, desc, eq, inArray } from "drizzle-orm";
import { assertRole, type Actor } from "../actor";
import { getDb } from "../db/client";
import { auditEvents, cmsPageVersions, editorialApplications, emailJobs, manuscripts, memberships, publications, publicationVersions, user } from "../db/schema";

/** Read-only data for the administration pages. Each function checks the role itself. */

export async function adminOverview(actor: Actor) {
  assertRole(actor, ["admin"]);
  const db = getDb();
  const [[apps], [waiting], [pendingMembers], [failedMail], [proposals]] = await Promise.all([
    db.select({ n: count() }).from(editorialApplications).where(eq(editorialApplications.status, "pending")),
    db.select({ n: count() }).from(manuscripts).where(inArray(manuscripts.status, ["submitted", "in_review", "resubmitted", "accepted"])),
    db.select({ n: count() }).from(memberships).where(eq(memberships.status, "pending")),
    db.select({ n: count() }).from(emailJobs).where(and(inArray(emailJobs.status, ["failed", "bounced", "complained"]))),
    db.select({ n: count() }).from(cmsPageVersions).where(eq(cmsPageVersions.status, "proposed")),
  ]);
  return { applications: apps.n, inProcess: waiting.n, pendingMembers: pendingMembers.n, failedMail: failedMail.n, proposals: proposals.n };
}

export async function listAuditEvents(actor: Actor, limit = 200) {
  assertRole(actor, ["admin"]);
  return getDb()
    .select({ id: auditEvents.id, action: auditEvents.action, targetType: auditEvents.targetType, targetId: auditEvents.targetId, metadata: auditEvents.metadata, createdAt: auditEvents.createdAt, actor: user.name })
    .from(auditEvents)
    .leftJoin(user, eq(user.id, auditEvents.actorId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}

export async function listEmailJobs(actor: Actor, problemsOnly: boolean) {
  assertRole(actor, ["admin"]);
  return getDb()
    .select({ id: emailJobs.id, kind: emailJobs.kind, toEmail: emailJobs.toEmail, subject: emailJobs.subject, status: emailJobs.status, attempts: emailJobs.attempts, lastError: emailJobs.lastError, updatedAt: emailJobs.updatedAt })
    .from(emailJobs)
    .where(problemsOnly ? inArray(emailJobs.status, ["failed", "bounced", "complained"]) : undefined)
    .orderBy(desc(emailJobs.createdAt))
    .limit(100);
}

/** Live articles, for choosing the front-page lead. */
export async function listLivePublications(actor: Actor) {
  assertRole(actor, ["admin"]);
  return getDb()
    .select({ id: publications.id, title: publicationVersions.title })
    .from(publications)
    .innerJoin(publicationVersions, eq(publicationVersions.id, publications.currentVersionId))
    .where(eq(publications.state, "live"));
}
