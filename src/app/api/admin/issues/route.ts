import { requireActor } from "@/server/actor";
import { checked, int } from "@/server/forms";
import { mutation } from "@/server/http";
import { createVolume, saveIssue } from "@/server/services/cms";

export const POST = mutation(async (req, input) => {
  const actor = await requireActor(req.headers, ["admin"]);
  if (input.action === "create_volume") {
    await createVolume(actor, int(input, "number", 0), input.label ?? "", input.yearLabel ?? "");
  } else {
    await saveIssue(actor, {
      id: input.id || undefined,
      volumeId: input.volumeId ?? "",
      number: int(input, "number", 0),
      termLabel: input.termLabel ?? "",
      visible: checked(input, "visible"),
      sortOrder: int(input, "sortOrder", 0),
    });
  }
  return { ok: true, notice: "issue_saved" };
});
