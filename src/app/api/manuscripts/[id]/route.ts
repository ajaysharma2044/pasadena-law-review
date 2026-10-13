import { requireActor } from "@/server/actor";
import { int } from "@/server/forms";
import { mutation } from "@/server/http";
import { saveDraft } from "@/server/services/manuscripts";

/** Saves the author's working copy (POST so plain HTML forms work). */
export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers);
  const pick = (k: string) => (k in input ? input[k] : undefined);
  const { version } = await saveDraft(actor, id, int(input, "expectedVersion", -1), {
    title: pick("title"),
    deck: pick("deck"),
    abstract: pick("abstract"),
    bodyMd: pick("bodyMd"),
    authorBio: pick("authorBio"),
    disclosure: pick("disclosure"),
    kind: pick("kind"),
  });
  return { ok: true, version, notice: "draft_saved" };
});
