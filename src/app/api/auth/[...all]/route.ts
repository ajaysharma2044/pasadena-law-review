import { getAuth } from "@/server/auth";

/**
 * Only the two links that arrive by email are served by the auth library directly.
 * Every other auth action goes through /api/session/* (rate-limited, generic responses).
 */
const PUBLIC_LINKS = [/^\/api\/auth\/verify-email$/, /^\/api\/auth\/reset-password\/[^/]+$/];

export async function GET(req: Request) {
  const { pathname } = new URL(req.url);
  if (!PUBLIC_LINKS.some((r) => r.test(pathname))) return new Response("Not found", { status: 404 });
  return getAuth().handler(req);
}

export async function POST() {
  return new Response("Not found", { status: 404 });
}
