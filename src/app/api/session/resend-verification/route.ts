import { mutation } from "@/server/http";
import { done, emailField, getAuth, limitBy } from "@/server/session-routes";

/** Always the same answer, so the form can't be used to discover accounts. */
export const POST = mutation(async (req, input) => {
  const email = emailField(input);
  await limitBy(req, "resend", [10, 3600], email, [3, 3600]);
  try {
    await getAuth().api.sendVerificationEmail({ body: { email, callbackURL: "/verify-email?confirmed=1" }, headers: req.headers });
  } catch {
    // Unknown or already-verified addresses get the same response.
  }
  return done(req, input, "verification_sent", "/verify-email");
});
