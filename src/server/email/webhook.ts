import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { emailEvents, emailJobs } from "../db/schema";

/**
 * Resend signs webhooks in the Svix format: HMAC-SHA256 over "<id>.<timestamp>.<raw body>",
 * keyed with the base64 secret after "whsec_". https://docs.svix.com/receiving/verifying-payloads/how-manual
 */
export const TOLERANCE_SECONDS = 5 * 60;

export function verifySignature(secret: string, headers: Headers, rawBody: string, nowMs = Date.now()): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signatures.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

const FINAL = new Set(["delivered", "bounced", "complained", "failed"]);
// https://resend.com/docs/webhooks/event-types (other events, e.g. email.delivery_delayed, are only recorded)
const MAP: Record<string, "delivered" | "bounced" | "complained" | "failed" | undefined> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "failed",
};

/** Records one verified event. Replays (same svix-id) are ignored. Statuses only move forward. */
export async function recordProviderEvent(eventId: string, payload: { type?: string; data?: { email_id?: string } }) {
  const db = getDb();
  const providerMessageId = payload.data?.email_id;
  const [job] = providerMessageId ? await db.select().from(emailJobs).where(eq(emailJobs.providerMessageId, providerMessageId)) : [];
  const inserted = await db
    .insert(emailEvents)
    .values({ jobId: job?.id ?? null, providerEventId: eventId, type: String(payload.type ?? "unknown").slice(0, 60) })
    .onConflictDoNothing({ target: emailEvents.providerEventId })
    .returning({ id: emailEvents.id });
  if (!inserted.length) return { duplicate: true };
  const next = MAP[payload.type ?? ""];
  if (job && next && !FINAL.has(job.status)) {
    await db.update(emailJobs).set({ status: next, updatedAt: new Date() }).where(eq(emailJobs.id, job.id));
  }
  return { duplicate: false, matched: Boolean(job) };
}
