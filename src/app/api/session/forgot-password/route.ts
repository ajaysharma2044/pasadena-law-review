import { mutation } from "@/server/http";
import { done, emailField, getAuth, limitBy } from "@/server/session-routes";

export const POST = mutation(async (req, input) => {
  const email = emailField(input);
  await limitBy(req, "forgot", [10, 3600], email, [3, 3600]);
  try {
    await getAuth().api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: req.headers });
  } catch {
    // Same response for unknown addresses.
  }
  return done(req, input, "reset_sent", "/forgot-password");
});
