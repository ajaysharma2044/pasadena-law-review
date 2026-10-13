import { randomUUID } from "node:crypto";
import { getConfig } from "../config";

export type Message = {
  to: string;
  from: string;
  replyTo: string | null;
  subject: string;
  text: string;
  idempotencyKey: string;
};

export interface EmailTransport {
  readonly name: string;
  send(message: Message): Promise<{ providerMessageId: string }>;
}

/** The provider rejected the message for a reason a retry won't fix (bad address, invalid sender). */
export class PermanentEmailError extends Error {}
/** A failure worth retrying (rate limit, provider outage, network). */
export class TransientEmailError extends Error {}

/**
 * Development only. Messages stay in the email_jobs table and appear at /dev/mailbox.
 * Nothing leaves the machine. Configuration refuses this transport in production.
 */
export class DevTransport implements EmailTransport {
  readonly name = "dev";
  async send() {
    return { providerMessageId: `dev-${randomUUID()}` };
  }
}

/** Resend HTTP API. https://resend.com/docs/api-reference/emails/send-email */
export class ResendTransport implements EmailTransport {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(m: Message) {
    let res: Response;
    try {
      res = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": m.idempotencyKey.slice(0, 256),
        },
        body: JSON.stringify({
          from: m.from,
          to: [m.to],
          subject: m.subject,
          text: m.text,
          ...(m.replyTo ? { reply_to: m.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new TransientEmailError(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (res.ok && body.id) return { providerMessageId: body.id };
    const detail = `Resend ${res.status}: ${body.message ?? body.name ?? "no detail"}`;
    if (res.status === 429 || res.status >= 500) throw new TransientEmailError(detail);
    throw new PermanentEmailError(detail);
  }
}

let override: EmailTransport | null = null;

export function getTransport(): EmailTransport {
  if (override) return override;
  const { email } = getConfig();
  return email.transport === "resend" ? new ResendTransport(email.apiKey) : new DevTransport();
}

/** Tests only. */
export function setTransportForTests(t: EmailTransport | null) {
  override = t;
}
