import { eq } from "drizzle-orm";
import type { Actor, Role } from "@/server/actor";
import { getDb } from "@/server/db/client";
import * as s from "@/server/db/schema";

let n = 0;

/** Inserts a verified, active account directly (service-level tests don't need the sign-in flow). */
export async function actor(role: Role = "member", name?: string): Promise<Actor> {
  n += 1;
  const id = `u${n}-${role}`;
  const email = `${id}@example.org`;
  const displayName = name ?? `${role[0].toUpperCase()}${role.slice(1)} ${n}`;
  await getDb().insert(s.user).values({ id, name: displayName, email, emailVerified: true });
  await getDb().insert(s.memberships).values({ userId: id, role, status: "active" });
  await getDb().insert(s.authorProfiles).values({ userId: id, displayName });
  return { userId: id, name: displayName, email, emailVerified: true, role, status: "active" };
}

export async function setRole(a: Actor, role: Role) {
  await getDb().update(s.memberships).set({ role }).where(eq(s.memberships.userId, a.userId));
  return { ...a, role };
}

export const sampleBody = "An argument.[^1]\n\n## I. Part\n\nMore text.\n\n[^1]: *See* :sc[Cal. Educ. Code] § 66300.";
