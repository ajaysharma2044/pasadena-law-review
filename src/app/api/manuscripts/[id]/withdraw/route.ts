import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { withdraw } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, _input, { id }) => {
  const actor = await requireActor(req.headers);
  await withdraw(actor, id);
  return { ok: true, notice: "withdrawn" };
});
