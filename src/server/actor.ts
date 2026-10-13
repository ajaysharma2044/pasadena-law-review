import { eq } from "drizzle-orm";
import { getAuth } from "./auth";
import { getDb } from "./db/client";
import { memberships } from "./db/schema";
import { forbidden, unauthorized } from "./errors";

export type Role = "member" | "editor" | "admin";

export type Actor = {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  status: "pending" | "active" | "suspended";
};

/**
 * Resolves the signed-in account from request headers. The role and status are read from the
 * database on every call, so suspension or a role change applies on the very next request.
 */
export async function getActor(headers: Headers): Promise<Actor | null> {
  const session = await getAuth().api.getSession({ headers, query: { disableCookieCache: true } });
  if (!session) return null;
  const db = getDb();
  let [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id));
  if (!m) {
    // The sign-up hook normally creates this row. If it is missing, create the least-privileged one.
    [m] = await db.insert(memberships).values({ userId: session.user.id }).onConflictDoNothing().returning();
    if (!m) [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id));
  }
  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    role: m.role,
    status: m.status,
  };
}

/** A signed-in, verified, active account, optionally with one of the given roles. */
export async function requireActor(headers: Headers, roles?: Role[]): Promise<Actor> {
  const actor = await getActor(headers);
  if (!actor) throw unauthorized();
  assertActive(actor);
  if (roles && !roles.includes(actor.role)) throw forbidden();
  return actor;
}

export function assertActive(actor: Actor) {
  if (!actor.emailVerified) throw forbidden("email_unverified", "Confirm your email address first.");
  if (actor.status === "suspended") throw forbidden("suspended", "This account is suspended.");
  if (actor.status === "pending") throw forbidden("pending_approval", "This account is waiting for approval.");
}

export const isEditor = (a: Actor) => a.role === "editor" || a.role === "admin";
export const isAdmin = (a: Actor) => a.role === "admin";
