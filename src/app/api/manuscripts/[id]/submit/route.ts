import { requireActor } from "@/server/actor";
import { checked, int } from "@/server/forms";
import { mutation } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { getForAuthor, submit } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers);
  await rateLimit(`submit:${actor.userId}`, 10, 86400);
  const before = await getForAuthor(actor, id);
  await submit(actor, id, int(input, "expectedVersion", -1), {
    authorship: checked(input, "confirm_authorship"),
    sources: checked(input, "confirm_sources"),
    disclosure: checked(input, "confirm_disclosure"),
  });
  return { ok: true, notice: before.manuscript.status === "changes_requested" ? "resubmitted" : "submitted" };
});
