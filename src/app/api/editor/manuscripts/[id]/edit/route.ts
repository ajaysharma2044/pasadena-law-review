import { requireActor } from "@/server/actor";
import { int } from "@/server/forms";
import { mutation } from "@/server/http";
import { editorEdit } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["editor", "admin"]);
  const r = await editorEdit(actor, id, input.baseRevisionId ?? "", int(input, "expectedLatestSeq", -1), {
    title: input.title ?? "",
    deck: input.deck ?? "",
    abstract: input.abstract ?? "",
    bodyMd: input.bodyMd ?? "",
    authorBio: input.authorBio ?? "",
    note: input.note ?? "",
  });
  return { ok: true, ...r, notice: "edit_saved" };
});
