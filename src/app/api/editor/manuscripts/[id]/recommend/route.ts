import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { recommend } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["editor", "admin"]);
  await recommend(actor, id, input.revisionId ?? "", input.recommendation ?? "", input.rationale ?? "");
  return { ok: true, notice: "recommended" };
});
