import { getConfig } from "./config";
import { AppError, forbidden } from "./errors";

/**
 * Route-handler plumbing shared by every mutation:
 * - rejects cross-site requests (the Origin header must match APP_URL);
 * - reads JSON or HTML form bodies;
 * - maps errors to JSON for scripts, or to a redirect with an error code for HTML forms.
 */

export type Input = Record<string, string>;
type Ctx<P> = { params: Promise<P> };

export function assertSameOrigin(req: Request) {
  const expected = new URL(getConfig().appUrl).origin;
  const origin = req.headers.get("origin");
  if (!origin || origin !== expected) throw forbidden("cross_site", "This request didn’t come from this site.");
}

export async function readInput(req: Request): Promise<Input> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const data = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === "string" ? v : v == null ? "" : String(v)]));
  }
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await req.formData();
    const out: Input = {};
    for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
    return out;
  }
  return {};
}

/** Accepts only same-site relative paths, so redirects can't be pointed at another site. */
export function safePath(p: string | null | undefined, fallback: string): string {
  if (!p || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return fallback;
  return p;
}

/** Browser form submissions ask for HTML and get redirects; scripts get JSON and status codes. */
export const wantsHtml = (req: Request) => (req.headers.get("accept") ?? "").includes("text/html");
const isForm = wantsHtml;

export function redirectTo(path: string, params: Record<string, string> = {}, extraHeaders?: Headers) {
  const url = new URL(path, getConfig().appUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers = new Headers(extraHeaders);
  headers.set("Location", url.pathname + url.search + url.hash);
  return new Response(null, { status: 303, headers });
}

type Handler<P> = (req: Request, input: Input, params: P) => Promise<Response | Record<string, unknown> | void>;

/**
 * Wraps a mutation. Forms send `_back` (where to return on error) and `_next` (where to go on success).
 * Handlers return a Response, a JSON-able object, or nothing.
 */
export function mutation<P = Record<string, string>>(handler: Handler<P>) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    const form = isForm(req);
    let input: Input = {};
    try {
      input = await readInput(req);
      assertSameOrigin(req);
      const result = await handler(req, input, await ctx.params);
      if (result instanceof Response) return result;
      if (form) return redirectTo(safePath(input._next, "/"), { notice: String(result?.notice ?? "saved") });
      return Response.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof AppError) {
        if (form) {
          const back = safePath(input._back ?? new URL(req.headers.get("referer") ?? "/", "http://x").pathname, "/");
          return redirectTo(back, { error: err.code });
        }
        return Response.json({ error: err.code, message: err.message, fields: err.fields }, { status: err.status });
      }
      console.error(err);
      if (form) return redirectTo(safePath(input._back, "/"), { error: "unexpected" });
      return Response.json({ error: "unexpected", message: "Something went wrong." }, { status: 500 });
    }
  };
}

/** Required, trimmed string field with a length limit. */
export function field(input: Input, name: string, opts: { max?: number; min?: number; label?: string; optional?: boolean } = {}) {
  const v = (input[name] ?? "").trim();
  const label = opts.label ?? name;
  if (!v && !opts.optional) throw new AppError(422, "invalid", `${label} is required.`, { [name]: "required" });
  if (opts.min && v.length < opts.min) throw new AppError(422, "invalid", `${label} is too short.`, { [name]: "too_short" });
  if (opts.max && v.length > opts.max) throw new AppError(422, "invalid", `${label} is too long.`, { [name]: "too_long" });
  return v;
}
