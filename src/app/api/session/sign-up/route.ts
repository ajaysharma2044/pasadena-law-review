import { AppError } from "@/server/errors";
import { field, mutation } from "@/server/http";
import { apiErrorStatus, done, emailField, getAuth, limitBy, passwordField } from "@/server/session-routes";

/** Same answer whether or not the address already has an account (no enumeration). */
export const POST = mutation(async (req, input) => {
  const name = field(input, "name", { max: 100, label: "Name" });
  const email = emailField(input);
  const password = passwordField(input);
  await limitBy(req, "signup", [10, 3600]);
  try {
    await getAuth().api.signUpEmail({ body: { name, email, password, callbackURL: "/verify-email" }, headers: req.headers });
  } catch (e) {
    if (apiErrorStatus(e) === null) throw e;
    throw new AppError(422, "signup_rejected", "That sign-up couldn’t be completed. Check the details and try again.");
  }
  return done(req, input, "check_email", "/signup");
});
