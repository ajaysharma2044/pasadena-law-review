import { AppError } from "@/server/errors";
import { mutation, redirectTo, safePath } from "@/server/http";
import { emailField, getAuth, isForm, limitBy, withCookies } from "@/server/session-routes";

export const POST = mutation(async (req, input) => {
  const email = emailField(input);
  const password = input.password ?? "";
  await limitBy(req, "signin", [30, 600], email, [8, 600]);
  const res = await getAuth().api.signInEmail({ body: { email, password }, headers: req.headers, asResponse: true });
  if (res.status === 403) throw new AppError(403, "email_unverified", "Confirm your email address before signing in.");
  if (!res.ok) throw new AppError(401, "invalid_credentials", "That email and password don’t match an account.");
  const out = isForm(req) ? redirectTo(safePath(input._next, "/dashboard")) : Response.json({ ok: true });
  return withCookies(res, out);
});
