import { requireActor } from "@/server/actor";
import { checked } from "@/server/forms";
import { mutation } from "@/server/http";
import { setCheck } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await setCheck(actor, id, checked(input, "resolved"));
  return { ok: true, notice: "check_updated" };
});
