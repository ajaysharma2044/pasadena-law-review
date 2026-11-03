import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { addNote } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["editorial_board", "admin"]);
  await addNote(actor, id, input.body ?? "");
  return { ok: true, notice: "note_added" };
});
