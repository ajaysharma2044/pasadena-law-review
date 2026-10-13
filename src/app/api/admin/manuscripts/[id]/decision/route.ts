import { requireActor } from "@/server/actor";
import { int } from "@/server/forms";
import { mutation } from "@/server/http";
import { decide } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await decide(actor, id, int(input, "expectedVersion", -1), input.decision ?? "", input.authorNote ?? "");
  return { ok: true, notice: "decided" };
});
