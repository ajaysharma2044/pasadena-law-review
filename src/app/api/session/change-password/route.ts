import { requireActor } from "@/server/actor";
import { AppError } from "@/server/errors";
import { mutation, redirectTo } from "@/server/http";
import { getAuth, isForm, limitBy, passwordField, withCookies } from "@/server/session-routes";

export const POST = mutation(async (req, input) => {
  const actor = await requireActor(req.headers);
  const newPassword = passwordField(input, "new_password");
  await limitBy(req, "change-password", [10, 3600], actor.email, [5, 3600]);
  const res = await getAuth().api.changePassword({
    body: { currentPassword: input.current_password ?? "", newPassword, revokeOtherSessions: true },
    headers: req.headers,
    asResponse: true,
  });
  if (!res.ok) throw new AppError(400, "wrong_password", "Your current password isn’t right.");
  return withCookies(res, isForm(req) ? redirectTo("/account", { notice: "password_changed" }) : Response.json({ ok: true }));
});
