import { requireActor } from "@/server/actor";
import { mutation, redirectTo, wantsHtml } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { createDraft } from "@/server/services/manuscripts";

export const POST = mutation(async (req, input) => {
  const actor = await requireActor(req.headers);
  await rateLimit(`draft:${actor.userId}`, 20, 86400);
  const { id } = await createDraft(actor, input.kind ?? "");
  if (wantsHtml(req)) return redirectTo(`/manuscripts/${id}`, { notice: "draft_saved" });
  return { ok: true, id };
});
