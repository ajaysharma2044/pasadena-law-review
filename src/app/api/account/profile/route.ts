import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { updateProfile } from "@/server/services/profile";

export const POST = mutation(async (req, input) => {
  const actor = await requireActor(req.headers);
  await updateProfile(actor, input.displayName ?? "", input.bio ?? "");
  return { ok: true, notice: "profile_saved" };
});
