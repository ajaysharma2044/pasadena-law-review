import { requireActor } from "@/server/actor";
import { int } from "@/server/forms";
import { mutation } from "@/server/http";
import { publish } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await publish(actor, id, {
    revisionId: input.revisionId ?? "",
    slug: input.slug ?? "",
    byline: input.byline ?? "",
    issueId: input.issueId || null,
    issueOrder: int(input, "issueOrder", 0),
  });
  return { ok: true, notice: "published" };
});
