import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActor, type Actor, type Role } from "./actor";

/** The signed-in account for the current page request (server components only). */
export async function currentActor(): Promise<Actor | null> {
  return getActor(await headers());
}

export type PageAccess =
  | { ok: true; actor: Actor }
  | { ok: false; reason: "suspended" | "pending_approval" | "email_unverified" | "forbidden"; actor: Actor };

/**
 * For private pages: redirects signed-out visitors to sign-in, and reports why a signed-in
 * account can't see the page. The page must render nothing private when `ok` is false.
 */
export async function pageAccess(nextPath: string, roles?: Role[]): Promise<PageAccess> {
  const actor = await currentActor();
  if (!actor) redirect(`/signin?next=${encodeURIComponent(nextPath)}`);
  if (!actor.emailVerified) return { ok: false, reason: "email_unverified", actor };
  if (actor.status === "suspended") return { ok: false, reason: "suspended", actor };
  if (actor.status === "pending") return { ok: false, reason: "pending_approval", actor };
  if (roles && !roles.includes(actor.role)) return { ok: false, reason: "forbidden", actor };
  return { ok: true, actor };
}
