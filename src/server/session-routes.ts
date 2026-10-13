import { APIError } from "better-auth/api";
import { getAuth } from "./auth";
import { AppError } from "./errors";
import { field, redirectTo, safePath, wantsHtml, type Input } from "./http";
import { clientIp, rateLimit } from "./ratelimit";

/** Shared helpers for the /api/session/* wrappers around the auth library. */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailField(input: Input) {
  const email = field(input, "email", { max: 254, label: "Email" }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new AppError(422, "invalid", "Enter a valid email address.", { email: "invalid" });
  return email;
}

export function passwordField(input: Input, name = "password") {
  const pw = input[name] ?? "";
  if (pw.length < 10) throw new AppError(422, "weak_password", "Use at least 10 characters.", { [name]: "too_short" });
  if (pw.length > 128) throw new AppError(422, "invalid", "Use at most 128 characters.", { [name]: "too_long" });
  if (input[`${name}_confirm`] !== undefined && input[`${name}_confirm`] !== pw) {
    throw new AppError(422, "password_mismatch", "The two passwords don’t match.", { [`${name}_confirm`]: "mismatch" });
  }
  return pw;
}

export async function limitBy(req: Request, scope: string, perIp: [number, number], email?: string, perEmail?: [number, number]) {
  await rateLimit(`${scope}:ip:${clientIp(req.headers)}`, perIp[0], perIp[1]);
  if (email && perEmail) await rateLimit(`${scope}:email:${email}`, perEmail[0], perEmail[1]);
}

/** Forwards the auth library's Set-Cookie headers on our own response. */
export function withCookies(from: Response, to: Response) {
  for (const c of from.headers.getSetCookie()) to.headers.append("Set-Cookie", c);
  return to;
}

export const isForm = wantsHtml;

export function done(req: Request, input: Input, notice: string, fallbackNext = "/") {
  return isForm(req) ? redirectTo(safePath(input._next, fallbackNext), { notice }) : Response.json({ ok: true, notice });
}

export function apiErrorStatus(e: unknown): number | null {
  return e instanceof APIError ? Number(e.statusCode ?? 400) : null;
}

export { getAuth };
