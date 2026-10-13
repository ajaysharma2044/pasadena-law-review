import { and, desc, eq } from "drizzle-orm";
import type { Actor } from "../actor";
import { audit } from "../audit";
import { getConfig } from "../config";
import { getDb } from "../db/client";
import { editorialApplications, memberships, user } from "../db/schema";
import { deliverSoon, enqueueEmail } from "../email/outbox";
import { templates } from "../email/templates";
import { conflict, forbidden, invalid, notFound } from "../errors";
import { getSettings } from "./settings";

export function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

export async function submitApplication(actor: Actor, statement: string, experience: string) {
  if (actor.role !== "member") throw conflict("already_editor", "You already have editorial access.");
  if (!statement.trim()) throw invalid("Tell us why you want to edit.", { statement: "required" });
  const db = getDb();
  const pub = (await getSettings()).publication_name;
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(editorialApplications)
        .values({ userId: actor.userId, statement: statement.slice(0, 4000), experience: experience.slice(0, 4000) })
        .returning({ id: editorialApplications.id });
      await audit(tx, { actorId: actor.userId, action: "application.submit", targetType: "application", targetId: row.id });
      const t = templates.applicationReceived(pub, actor.name, `${getConfig().appUrl}/account`);
      await enqueueEmail(tx, { kind: "application_received", to: actor.email, toUserId: actor.userId, ...t, idempotencyKey: `application:${row.id}:received` });
      return row.id;
    });
    await deliverSoon();
    return id;
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("pending_exists", "You already have an application waiting for a decision.");
    throw e;
  }
}

export async function withdrawApplication(actor: Actor, id: string) {
  const db = getDb();
  const rows = await db
    .update(editorialApplications)
    .set({ status: "withdrawn" })
    .where(and(eq(editorialApplications.id, id), eq(editorialApplications.userId, actor.userId), eq(editorialApplications.status, "pending")))
    .returning({ id: editorialApplications.id });
  if (!rows.length) throw notFound();
  await audit(db, { actorId: actor.userId, action: "application.withdraw", targetType: "application", targetId: id });
}

export async function decideApplication(actor: Actor, id: string, decision: string, note = "") {
  if (actor.role !== "admin") throw forbidden();
  if (decision !== "approve" && decision !== "decline") throw invalid("Choose approve or decline.", { decision: "invalid" });
  const db = getDb();
  const pub = (await getSettings()).publication_name;
  await db.transaction(async (tx) => {
    const [app] = await tx.select().from(editorialApplications).where(eq(editorialApplications.id, id)).for("update");
    if (!app) throw notFound();
    if (app.userId === actor.userId) throw forbidden("self_decision", "Another administrator has to decide your own application.");
    if (app.status !== "pending") throw conflict("already_decided", "This application has already been decided.");
    await tx
      .update(editorialApplications)
      .set({ status: decision === "approve" ? "approved" : "declined", decisionNote: note.slice(0, 2000) || null, decidedBy: actor.userId, decidedAt: new Date() })
      .where(eq(editorialApplications.id, id));
    if (decision === "approve") {
      await tx
        .update(memberships)
        .set({ role: "editor", updatedBy: actor.userId, updatedAt: new Date() })
        .where(and(eq(memberships.userId, app.userId), eq(memberships.role, "member")));
    }
    await audit(tx, { actorId: actor.userId, action: `application.${decision}`, targetType: "application", targetId: id, metadata: { applicant: app.userId } });
    const [applicant] = await tx.select().from(user).where(eq(user.id, app.userId));
    if (applicant) {
      const t = templates.applicationDecided(pub, applicant.name, decision === "approve", note.slice(0, 600), `${getConfig().appUrl}/account`);
      await enqueueEmail(tx, { kind: "application_decided", to: applicant.email, toUserId: applicant.id, ...t, idempotencyKey: `application:${id}:decision` });
    }
  });
  await deliverSoon();
}

export async function listApplications(status?: string) {
  const valid = ["pending", "approved", "declined", "withdrawn"].includes(status ?? "") ? (status as "pending") : undefined;
  return getDb()
    .select({
      id: editorialApplications.id,
      status: editorialApplications.status,
      statement: editorialApplications.statement,
      experience: editorialApplications.experience,
      decisionNote: editorialApplications.decisionNote,
      createdAt: editorialApplications.createdAt,
      decidedAt: editorialApplications.decidedAt,
      userId: user.id,
      name: user.name,
      email: user.email,
    })
    .from(editorialApplications)
    .innerJoin(user, eq(user.id, editorialApplications.userId))
    .where(valid ? eq(editorialApplications.status, valid) : undefined)
    .orderBy(desc(editorialApplications.createdAt));
}

export async function myApplications(actor: Actor) {
  return getDb()
    .select()
    .from(editorialApplications)
    .where(eq(editorialApplications.userId, actor.userId))
    .orderBy(desc(editorialApplications.createdAt));
}
