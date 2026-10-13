import { eq } from "drizzle-orm";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resetAuthForTests } from "@/server/auth";
import { loadConfig, setConfigForTests } from "@/server/config";
import { getDb } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { processDueEmails } from "@/server/email/outbox";
import { setTransportForTests } from "@/server/email/transports";
import { createTestDb } from "./db";

export const ORIGIN = "http://localhost:3000";

/** Fresh database, test configuration and auth instance. */
export async function setupApp(env: Record<string, string> = {}) {
  const uploads = mkdtempSync(path.join(tmpdir(), "plr-uploads-"));
  setConfigForTests(loadConfig({ NODE_ENV: "test", RATE_LIMITS: "off", STORAGE_LOCAL_DIR: uploads, ...env }));
  setTransportForTests(null);
  resetAuthForTests();
  return createTestDb();
}

type RouteModule = Record<string, unknown>;
type CallOpts = {
  cookie?: string;
  json?: unknown;
  form?: Record<string, string>;
  params?: Record<string, string>;
  origin?: string | null;
  headers?: Record<string, string>;
  body?: BodyInit;
};

/** Invokes a Next.js route handler directly, the way a browser or script would hit it. */
export async function call(mod: RouteModule, method: string, url: string, opts: CallOpts = {}): Promise<Response> {
  const headers = new Headers(opts.headers);
  if (opts.origin !== null) headers.set("origin", opts.origin ?? ORIGIN);
  if (opts.cookie) headers.set("cookie", opts.cookie);
  let body = opts.body;
  if (opts.form) {
    headers.set("content-type", "application/x-www-form-urlencoded");
    body = new URLSearchParams(opts.form).toString();
  } else if (opts.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(opts.json);
  }
  const fn = mod[method] as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
  if (typeof fn !== "function") throw new Error(`route has no ${method} handler`);
  const req = new Request(new URL(url, ORIGIN), { method, headers, body });
  return fn(req, { params: Promise.resolve(opts.params ?? {}) });
}

/** "name=value; name2=value2" from a response's Set-Cookie headers. */
export function cookiesFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
}

/** Delivers queued mail with the development transport and returns the newest link sent to `to`. */
export async function latestLink(to: string, kind: "verify_email" | "reset_password"): Promise<string> {
  await processDueEmails();
  const jobs = await getDb().select().from(s.emailJobs).where(eq(s.emailJobs.toEmail, to));
  const job = jobs.filter((j) => j.kind === kind).sort((a, b) => +b.createdAt - +a.createdAt)[0];
  if (!job) throw new Error(`no ${kind} email for ${to}`);
  const m = job.textBody.match(/https?:\/\/\S+/);
  if (!m) throw new Error("no link in email");
  return m[0];
}
