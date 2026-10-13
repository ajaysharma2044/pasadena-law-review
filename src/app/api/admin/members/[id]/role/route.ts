import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { changeRole } from "@/server/services/members";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await changeRole(actor, id, input.role ?? "", input.note ?? "");
  return { ok: true, notice: "role_changed" };
});
