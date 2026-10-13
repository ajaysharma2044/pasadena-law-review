import { requireActor } from "@/server/actor";
import { audit } from "@/server/audit";
import { getDb } from "@/server/db/client";
import { deliverSoon, requeueEmail } from "@/server/email/outbox";
import { notFound } from "@/server/errors";
import { mutation } from "@/server/http";

export const POST = mutation<{ id: string }>(async (req, _input, { id }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  if (!(await requeueEmail(getDb(), id))) throw notFound();
  await audit(getDb(), { actorId: actor.userId, action: "email.retry", targetType: "email", targetId: id });
  await deliverSoon();
  return { ok: true, notice: "email_requeued" };
});
