import { requireActor } from "@/server/actor";
import { mutation, redirectTo, wantsHtml } from "@/server/http";
import { removeAttachment } from "@/server/services/attachments";

export const POST = mutation<{ id: string }>(async (req, _input, { id }) => {
  const actor = await requireActor(req.headers);
  const manuscriptId = await removeAttachment(actor, id);
  if (wantsHtml(req)) return redirectTo(`/manuscripts/${manuscriptId}`, { notice: "attachment_removed" });
  return { ok: true };
});
