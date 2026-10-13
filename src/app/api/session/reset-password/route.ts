import { AppError } from "@/server/errors";
import { field, mutation } from "@/server/http";
import { apiErrorStatus, done, getAuth, limitBy, passwordField } from "@/server/session-routes";

export const POST = mutation(async (req, input) => {
  const token = field(input, "token", { max: 400, label: "Reset link" });
  const password = passwordField(input);
  await limitBy(req, "reset", [20, 3600]);
  try {
    await getAuth().api.resetPassword({ body: { newPassword: password, token }, headers: req.headers });
  } catch (e) {
    if (apiErrorStatus(e) === null) throw e;
    throw new AppError(400, "invalid_or_expired_link", "That reset link is invalid or has expired. Ask for a new one.");
  }
  return done(req, input, "password_reset", "/signin");
});
