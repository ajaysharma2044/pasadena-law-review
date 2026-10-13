import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { addFeedback } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["editor", "admin"]);
  await addFeedback(actor, id, input.body ?? "");
  return { ok: true, notice: "feedback_sent" };
});
