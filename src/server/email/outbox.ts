import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { getConfig } from "../config";
import { getDb, type Executor } from "../db/client";
import { emailJobs } from "../db/schema";
import { getTransport, PermanentEmailError } from "./transports";

/**
 * Transactional outbox. Domain changes insert a job in the same transaction; delivery happens
 * after commit and is retried with backoff. A job is identified by its idempotency key, so a
 * repeated click or retry never produces a second email.
 */

export type OutgoingEmail = {
  kind: string;
  to: string;
  toUserId?: string | null;
  subject: string;
  text: string;
  idempotencyKey: string;
};

export const MAX_ATTEMPTS = 6;
// Minutes to wait after attempt n (1-based) fails.
export const BACKOFF_MINUTES = [1, 5, 15, 60, 360];

// Kinds whose body carries a sign-in or reset link; the body is redacted once the provider accepts it.
const TOKEN_KINDS = new Set(["verify_email", "reset_password"]);

export async function enqueueEmail(db: Executor, email: OutgoingEmail): Promise<string | null> {
  const rows = await db
    .insert(emailJobs)
    .values({
      kind: email.kind,
      toEmail: email.to,
      toUserId: email.toUserId ?? null,
      subject: email.subject,
      textBody: email.text,
      idempotencyKey: email.idempotencyKey,
    })
    .onConflictDoNothing({ target: emailJobs.idempotencyKey })
    .returning({ id: emailJobs.id });
  return rows[0]?.id ?? null;
}

/** Claims due jobs (skipping rows another runner holds) and delivers them. Returns per-job outcomes. */
export async function processDueEmails(opts: { limit?: number; now?: Date } = {}) {
  const db = getDb();
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 20;

  const claimed = await db.transaction(async (tx) => {
    const due = await tx
      .select({ id: emailJobs.id })
      .from(emailJobs)
      .where(and(eq(emailJobs.status, "queued"), lte(emailJobs.nextAttemptAt, now)))
      .orderBy(asc(emailJobs.nextAttemptAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (!due.length) return [];
    return tx
      .update(emailJobs)
      .set({ status: "sending", attempts: sql`${emailJobs.attempts} + 1`, updatedAt: now })
      .where(inArray(emailJobs.id, due.map((d) => d.id)))
      .returning();
  });

  const transport = getTransport();
  const config = getConfig();
  const results: { id: string; status: string }[] = [];
  for (const job of claimed) {
    try {
      const { providerMessageId } = await transport.send({
        to: job.toEmail,
        from: config.email.from,
        replyTo: config.email.replyTo,
        subject: job.subject,
        text: job.textBody,
        idempotencyKey: job.idempotencyKey,
      });
      const redact = TOKEN_KINDS.has(job.kind) && config.email.transport !== "dev";
      await db
        .update(emailJobs)
        .set({
          status: "accepted",
          providerMessageId,
          lastError: null,
          updatedAt: new Date(),
          ...(redact ? { textBody: "(link removed after sending)" } : {}),
        })
        .where(eq(emailJobs.id, job.id));
      results.push({ id: job.id, status: "accepted" });
    } catch (err) {
      const permanent = err instanceof PermanentEmailError;
      const exhausted = job.attempts >= MAX_ATTEMPTS;
      const message = err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
      if (permanent || exhausted) {
        await db.update(emailJobs).set({ status: "failed", lastError: message, updatedAt: new Date() }).where(eq(emailJobs.id, job.id));
        results.push({ id: job.id, status: "failed" });
      } else {
        const wait = BACKOFF_MINUTES[Math.min(job.attempts - 1, BACKOFF_MINUTES.length - 1)];
        await db
          .update(emailJobs)
          .set({ status: "queued", lastError: message, nextAttemptAt: new Date(now.getTime() + wait * 60_000), updatedAt: new Date() })
          .where(eq(emailJobs.id, job.id));
        results.push({ id: job.id, status: "retry" });
      }
    }
  }
  return results;
}

/** Deliver soon after the current request finishes; retries are picked up by the job runner. */
export async function deliverSoon() {
  const run = () => processDueEmails().catch((e) => console.error("email dispatch failed", e));
  try {
    const { after } = await import("next/server");
    after(run);
  } catch {
    // Outside a Next.js request (scripts, tests): leave jobs queued for the runner.
  }
}

/** Manual retry of a failed job by an administrator. */
export async function requeueEmail(db: Executor, id: string) {
  const rows = await db
    .update(emailJobs)
    .set({ status: "queued", nextAttemptAt: new Date(), attempts: 0, updatedAt: new Date() })
    .where(and(eq(emailJobs.id, id), eq(emailJobs.status, "failed")))
    .returning({ id: emailJobs.id });
  return rows.length > 0;
}
