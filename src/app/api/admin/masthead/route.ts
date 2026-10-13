import { requireActor } from "@/server/actor";
import { checked } from "@/server/forms";
import { mutation } from "@/server/http";
import { saveMasthead } from "@/server/services/cms";

export const POST = mutation(async (req, input) => {
  const actor = await requireActor(req.headers, ["admin"]);
  const entries = Array.from({ length: 12 }, (_, i) => ({ roleTitle: input[`role_${i}`] ?? "", personName: input[`name_${i}`] ?? "" }));
  await saveMasthead(actor, entries, checked(input, "publish"));
  return { ok: true, notice: "masthead_saved" };
});
