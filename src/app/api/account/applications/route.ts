import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { submitApplication } from "@/server/services/applications";

export const POST = mutation(async (req, input) => {
  const actor = await requireActor(req.headers);
  await rateLimit(`application:${actor.userId}`, 5, 86400);
  const id = await submitApplication(actor, input.statement ?? "", input.experience ?? "");
  return { ok: true, id, notice: "application_sent" };
});
