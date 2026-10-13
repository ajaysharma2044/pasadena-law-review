import { requireActor } from "@/server/actor";
import { checked } from "@/server/forms";
import { mutation } from "@/server/http";
import { updateSettings } from "@/server/services/cms";

export const POST = mutation(async (req, input) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await updateSettings(actor, {
    publication_name: (input.publication_name ?? "").trim(),
    publication_tagline: (input.publication_tagline ?? "").trim(),
    nameplate_issue_line: (input.nameplate_issue_line ?? "").trim(),
    contact_email: (input.contact_email ?? "").trim(),
    instagram_handle: (input.instagram_handle ?? "").trim().replace(/^@/, ""),
    timezone: (input.timezone ?? "").trim(),
    front_lead_publication_id: input.front_lead_publication_id || null,
    membership_requires_approval: checked(input, "membership_requires_approval"),
    submissions_open: checked(input, "submissions_open"),
    submission_deadline_note: (input.submission_deadline_note ?? "").trim(),
  });
  return { ok: true, notice: "settings_saved" };
});
