import { requireActor } from "@/server/actor";
import { checked } from "@/server/forms";
import { mutation, redirectTo, wantsHtml } from "@/server/http";
import { saveMeeting } from "@/server/services/cms";

/** Editors save draft meetings; the service refuses public changes unless the account is an administrator. */
export const POST = mutation(async (req, input) => {
  const actor = await requireActor(req.headers, ["editor", "admin"]);
  const id = input.id || null;
  const r = await saveMeeting(actor, id, id ? Number.parseInt(input.expectedVersion ?? "-1", 10) : null, {
    status: input.status ?? "draft",
    startsAtLocal: input.startsAtLocal ?? "",
    timezone: input.timezone ?? "America/Los_Angeles",
    location: input.location ?? "",
    motion: input.motion ?? "",
    openerFor: input.openerFor ?? "",
    openerAgainst: input.openerAgainst ?? "",
    attendancePolicy: input.attendancePolicy ?? "",
    minutesMd: input.minutesMd ?? "",
    minutesPublished: checked(input, "minutesPublished"),
  });
  if (wantsHtml(req)) return redirectTo(`/editor/meetings/${r.id}`, { notice: "meeting_saved" });
  return { ok: true, ...r };
});
