import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as webhookRoute from "@/app/api/webhooks/resend/route";
import { loadConfig, setConfigForTests } from "@/server/config";
import { getDb } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { BACKOFF_MINUTES, MAX_ATTEMPTS, enqueueEmail, processDueEmails } from "@/server/email/outbox";
import { PermanentEmailError, ResendTransport, TransientEmailError, setTransportForTests, type EmailTransport } from "@/server/email/transports";
import { verifySignature } from "@/server/email/webhook";
import { call, setupApp } from "./helpers/app";

let handle: Awaited<ReturnType<typeof setupApp>>;
beforeEach(async () => {
  handle = await setupApp();
});
afterEach(async () => {
  setTransportForTests(null);
  await handle.close();
});

const job = (key: string, kind = "submission_received") => ({ kind, to: "a@example.org", subject: "Hi", text: "Body", idempotencyKey: key });
const getJob = async (key: string) => (await getDb().select().from(s.emailJobs).where(eq(s.emailJobs.idempotencyKey, key)))[0];

class Scripted implements EmailTransport {
  readonly name = "scripted";
  calls = 0;
  constructor(private readonly outcomes: ("ok" | "transient" | "permanent")[]) {}
  async send() {
    const o = this.outcomes[Math.min(this.calls, this.outcomes.length - 1)];
    this.calls += 1;
    if (o === "transient") throw new TransientEmailError("provider unavailable");
    if (o === "permanent") throw new PermanentEmailError("invalid recipient");
    return { providerMessageId: `msg-${this.calls}` };
  }
}

describe("outbox", () => {
  it("creates one job per idempotency key and starts as queued, never delivered", async () => {
    await enqueueEmail(getDb(), job("k1"));
    await enqueueEmail(getDb(), job("k1"));
    const rows = await getDb().select().from(s.emailJobs);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("queued");
  });

  it("retries transient failures with increasing waits, then gives up as failed", async () => {
    const t = new Scripted(["transient"]);
    setTransportForTests(t);
    await enqueueEmail(getDb(), job("k2"));
    let now = new Date();
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      await processDueEmails({ now });
      const j = await getJob("k2");
      expect(j.status).toBe("queued");
      expect(j.attempts).toBe(attempt);
      const waitMs = BACKOFF_MINUTES[attempt - 1] * 60_000;
      expect(j.nextAttemptAt.getTime() - now.getTime()).toBeGreaterThanOrEqual(waitMs - 1000);
      expect(await processDueEmails({ now })).toHaveLength(0); // not due yet
      now = new Date(j.nextAttemptAt.getTime() + 1000);
    }
    await processDueEmails({ now });
    const final = await getJob("k2");
    expect(final.status).toBe("failed");
    expect(final.attempts).toBe(MAX_ATTEMPTS);
    expect(final.lastError).toMatch(/unavailable/);
  });

  it("fails permanent errors without retrying", async () => {
    setTransportForTests(new Scripted(["permanent"]));
    await enqueueEmail(getDb(), job("k3"));
    await processDueEmails();
    expect((await getJob("k3")).status).toBe("failed");
    expect((await getJob("k3")).attempts).toBe(1);
  });

  it("marks success as accepted (not delivered) and removes links from sent token emails", async () => {
    setConfigForTests(loadConfig({ NODE_ENV: "test", RATE_LIMITS: "off", EMAIL_TRANSPORT: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "x@example.org" }));
    setTransportForTests(new Scripted(["ok"]));
    await enqueueEmail(getDb(), { ...job("k4", "reset_password"), text: "Reset: https://example.org/api/auth/reset-password/secret-token" });
    await processDueEmails();
    const j = await getJob("k4");
    expect(j.status).toBe("accepted");
    expect(j.providerMessageId).toBe("msg-1");
    expect(j.textBody).not.toContain("secret-token");
  });

  it("never sends one job twice when two runners overlap", async () => {
    const t = new Scripted(["ok"]);
    setTransportForTests(t);
    for (let i = 0; i < 5; i++) await enqueueEmail(getDb(), job(`p${i}`));
    await Promise.all([processDueEmails(), processDueEmails(), processDueEmails()]);
    expect(t.calls).toBe(5);
  });
});

describe("Resend transport", () => {
  const fakeFetch = (status: number, body: unknown, seen: Request[] = []) =>
    (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Request(input, init));
      return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;

  it("sends the idempotency key and returns the provider id", async () => {
    const seen: Request[] = [];
    const t = new ResendTransport("re_key", fakeFetch(200, { id: "abc" }, seen));
    const r = await t.send({ to: "a@b.org", from: "x@y.org", replyTo: null, subject: "s", text: "t", idempotencyKey: "decision:1:author" });
    expect(r.providerMessageId).toBe("abc");
    expect(seen[0].headers.get("idempotency-key")).toBe("decision:1:author");
    expect(seen[0].headers.get("authorization")).toBe("Bearer re_key");
  });

  it.each([
    [429, TransientEmailError],
    [503, TransientEmailError],
    [422, PermanentEmailError],
    [403, PermanentEmailError],
  ])("classifies HTTP %i", async (status, kind) => {
    const t = new ResendTransport("re_key", fakeFetch(status, { message: "nope" }));
    await expect(t.send({ to: "a@b.org", from: "x@y.org", replyTo: null, subject: "s", text: "t", idempotencyKey: "k" })).rejects.toBeInstanceOf(kind);
  });

  it("treats network errors as transient", async () => {
    const t = new ResendTransport("re_key", (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch);
    await expect(t.send({ to: "a@b.org", from: "x@y.org", replyTo: null, subject: "s", text: "t", idempotencyKey: "k" })).rejects.toBeInstanceOf(TransientEmailError);
  });
});

describe("delivery webhooks", () => {
  const SECRET = `whsec_${Buffer.from("webhook-test-secret-bytes").toString("base64")}`;
  const sign = (id: string, ts: number, body: string) =>
    `v1,${createHmac("sha256", Buffer.from(SECRET.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest("base64")}`;
  const headers = (id: string, ts: number, body: string) => ({ "svix-id": id, "svix-timestamp": String(ts), "svix-signature": sign(id, ts, body) });

  beforeEach(() => {
    setConfigForTests(loadConfig({ NODE_ENV: "test", RATE_LIMITS: "off", EMAIL_TRANSPORT: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "x@example.org", RESEND_WEBHOOK_SECRET: SECRET }));
  });

  it("verifies signatures and rejects tampering and stale timestamps", () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = '{"type":"email.delivered"}';
    expect(verifySignature(SECRET, new Headers(headers("evt_1", ts, body)), body)).toBe(true);
    expect(verifySignature(SECRET, new Headers(headers("evt_1", ts, body)), body.replace("delivered", "bounced"))).toBe(false);
    expect(verifySignature(SECRET, new Headers(headers("evt_1", ts - 3600, body)), body)).toBe(false);
    expect(verifySignature(SECRET, new Headers({ "svix-id": "evt_1", "svix-timestamp": String(ts), "svix-signature": "v1,AAAA" }), body)).toBe(false);
  });

  it("moves an accepted job to delivered once, and ignores a replayed event", async () => {
    setTransportForTests(new Scripted(["ok"]));
    await enqueueEmail(getDb(), job("k5"));
    await processDueEmails();
    const body = JSON.stringify({ type: "email.delivered", data: { email_id: "msg-1" } });
    const ts = Math.floor(Date.now() / 1000);
    const first = await call(webhookRoute, "POST", "/api/webhooks/resend", { origin: null, headers: { ...headers("evt_9", ts, body), "content-type": "application/json" }, body });
    expect(first.status).toBe(200);
    expect((await getJob("k5")).status).toBe("delivered");
    await call(webhookRoute, "POST", "/api/webhooks/resend", { origin: null, headers: { ...headers("evt_9", ts, body), "content-type": "application/json" }, body });
    expect(await getDb().select().from(s.emailEvents)).toHaveLength(1);
    const forged = await call(webhookRoute, "POST", "/api/webhooks/resend", { origin: null, headers: { ...headers("evt_10", ts, body), "content-type": "application/json" }, body: body.replace("delivered", "bounced") });
    expect(forged.status).toBe(401);
    expect((await getJob("k5")).status).toBe("delivered");
  });
});
