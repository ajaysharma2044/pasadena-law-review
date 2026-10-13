import { getConfig } from "@/server/config";
import { recordProviderEvent, verifySignature } from "@/server/email/webhook";

/** Delivery events from Resend. Rejected unless the signature and timestamp check out. */
export async function POST(req: Request) {
  const { email } = getConfig();
  if (email.transport !== "resend" || !email.webhookSecret) return new Response("Not configured", { status: 404 });
  const raw = await req.text();
  if (raw.length > 256 * 1024) return new Response("Too large", { status: 413 });
  if (!verifySignature(email.webhookSecret, req.headers, raw)) return new Response("Invalid signature", { status: 401 });
  let payload: { type?: string; data?: { email_id?: string } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  await recordProviderEvent(req.headers.get("svix-id")!, payload);
  return Response.json({ ok: true });
}
