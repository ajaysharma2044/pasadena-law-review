import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { withdrawApplication } from "@/server/services/applications";

export const POST = mutation<{ id: string }>(async (req, _input, { id }) => {
  const actor = await requireActor(req.headers);
  await withdrawApplication(actor, id);
  return { ok: true, notice: "application_withdrawn" };
});
