import { and, asc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { assertRole, type Actor, type Role } from "../actor";
import { audit } from "../audit";
import { getDb, type DB, type Tx } from "../db/client";
import { authorProfiles, memberships, session, user } from "../db/schema";
import { conflict, forbidden, invalid, notFound } from "../errors";

const ROLES: Role[] = ["member", "editor", "admin"];

async function lockActiveAdmins(tx: Tx) {
  return tx
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.role, "admin"), eq(memberships.status, "active")))
    .for("update");
}

async function lockMembership(tx: Tx, userId: string) {
  const [m] = await tx.select().from(memberships).where(eq(memberships.userId, userId)).for("update");
  if (!m) throw notFound();
  return m;
}

/** Changes a member's role. Only administrators reach this (checked by the caller and here). */
export async function changeRole(actor: Actor, targetId: string, role: string, note = "") {
  if (actor.role !== "admin") throw forbidden();
  if (!ROLES.includes(role as Role)) throw invalid("Choose member, editor or administrator.", { role: "invalid" });
  const db = getDb();
  await db.transaction(async (tx) => {
    const admins = await lockActiveAdmins(tx);
    const target = await lockMembership(tx, targetId);
    if (target.role === role) return;
    const losingAdmin = target.role === "admin" && target.status === "active";
    if (losingAdmin && admins.filter((a) => a.userId !== targetId).length === 0) {
      throw conflict("last_admin", "This is the last active administrator. Make someone else an administrator first.");
    }
    await tx
      .update(memberships)
      .set({ role: role as Role, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(memberships.userId, targetId));
    await audit(tx, {
      actorId: actor.userId,
      action: "member.role",
      targetType: "user",
      targetId,
      metadata: { from: target.role, to: role, note: note.slice(0, 300) || null },
    });
  });
}

/** Suspends, reactivates, or approves (pending to active) an account. Suspension ends every session. */
export async function setStatus(actor: Actor, targetId: string, status: string, reason = "") {
  if (actor.role !== "admin") throw forbidden();
  if (status !== "active" && status !== "suspended") throw invalid("Choose active or suspended.", { status: "invalid" });
  if (status === "suspended" && targetId === actor.userId) throw conflict("self_suspend", "You can’t suspend your own account.");
  const db = getDb();
  await db.transaction(async (tx) => {
    const admins = await lockActiveAdmins(tx);
    const target = await lockMembership(tx, targetId);
    if (target.status === status) return;
    if (status === "suspended" && target.role === "admin" && target.status === "active" && admins.filter((a) => a.userId !== targetId).length === 0) {
      throw conflict("last_admin", "This is the last active administrator.");
    }
    await tx
      .update(memberships)
      .set({ status, statusReason: reason.slice(0, 300) || null, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(memberships.userId, targetId));
    if (status === "suspended") await tx.delete(session).where(eq(session.userId, targetId));
    await audit(tx, {
      actorId: actor.userId,
      action: status === "suspended" ? "member.suspend" : target.status === "pending" ? "member.approve" : "member.reactivate",
      targetType: "user",
      targetId,
      metadata: { reason: reason.slice(0, 300) || null },
    });
  });
}

/**
 * Operator-only (CLI): makes a verified account the first administrator.
 * Refuses when any active administrator already exists.
 */
export async function bootstrapAdmin(db: DB, email: string) {
  await db.transaction(async (tx) => {
    const admins = await lockActiveAdmins(tx);
    if (admins.length) throw new Error("An active administrator already exists. Grant roles from the admin screens instead.");
    const [u] = await tx.select().from(user).where(sql`lower(${user.email}) = lower(${email.trim()})`);
    if (!u) throw new Error("No account uses that email. Sign up on the site first.");
    if (!u.emailVerified) throw new Error("That account hasn’t verified its email address yet.");
    await tx
      .insert(memberships)
      .values({ userId: u.id, role: "admin", status: "active" })
      .onConflictDoUpdate({ target: memberships.userId, set: { role: "admin", status: "active", updatedAt: new Date() } });
    await audit(tx, { actorId: null, action: "admin.bootstrap", targetType: "user", targetId: u.id });
  });
}

export async function listMembers(actor: Actor, filters: { q?: string; role?: string; status?: string }) {
  assertRole(actor, ["admin"]);
  const conds: SQL[] = [];
  if (filters.q?.trim()) {
    const q = `%${filters.q.trim().replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(user.name, q), ilike(user.email, q))!);
  }
  if (filters.role && ROLES.includes(filters.role as Role)) conds.push(eq(memberships.role, filters.role as Role));
  if (filters.status && ["pending", "active", "suspended"].includes(filters.status)) {
    conds.push(eq(memberships.status, filters.status as "pending" | "active" | "suspended"));
  }
  return getDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      role: memberships.role,
      status: memberships.status,
      statusReason: memberships.statusReason,
      displayName: authorProfiles.displayName,
    })
    .from(user)
    .innerJoin(memberships, eq(memberships.userId, user.id))
    .leftJoin(authorProfiles, eq(authorProfiles.userId, user.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(user.name))
    .limit(200);
}

export async function listEditors(actor: Actor) {
  assertRole(actor, ["admin"]);
  return getDb()
    .select({ id: user.id, name: user.name, email: user.email, role: memberships.role })
    .from(user)
    .innerJoin(memberships, eq(memberships.userId, user.id))
    .where(and(ne(memberships.role, "member"), eq(memberships.status, "active")))
    .orderBy(asc(user.name));
}
