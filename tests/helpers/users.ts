import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import * as s from "@/server/db/schema";
import * as authRoute from "@/app/api/auth/[...all]/route";
import * as signInRoute from "@/app/api/session/sign-in/route";
import * as signUpRoute from "@/app/api/session/sign-up/route";
import { call, cookiesFrom, latestLink } from "./app";

export const PASSWORD = "correct horse battery";

export async function signUp(email: string, name = email.split("@")[0], password = PASSWORD, extra: Record<string, unknown> = {}) {
  return call(signUpRoute, "POST", "/api/session/sign-up", { json: { name, email, password, ...extra } });
}

/** Opens the verification link from the mailbox; returns the response (redirect, session cookie on first use). */
export async function openVerificationLink(email: string) {
  const link = await latestLink(email, "verify_email");
  return call(authRoute, "GET", link, { origin: null });
}

export async function signIn(email: string, password = PASSWORD) {
  const res = await call(signInRoute, "POST", "/api/session/sign-in", { json: { email, password } });
  return { res, cookie: cookiesFrom(res) };
}

/** A verified, signed-in account with the given role (role set directly, as test setup). */
export async function makeUser(email: string, role: "member" | "editor" | "admin" = "member") {
  await signUp(email);
  await openVerificationLink(email);
  const [u] = await getDb().select().from(s.user).where(eq(s.user.email, email));
  if (role !== "member") await getDb().update(s.memberships).set({ role }).where(eq(s.memberships.userId, u.id));
  const { cookie } = await signIn(email);
  if (!cookie) throw new Error(`sign-in failed for ${email}`);
  return { id: u.id, email, cookie };
}

export async function membershipOf(userId: string) {
  const [m] = await getDb().select().from(s.memberships).where(eq(s.memberships.userId, userId));
  return m;
}
