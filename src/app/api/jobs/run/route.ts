import { timingSafeEqual } from "node:crypto";
import { getConfig } from "@/server/config";
import { processDueEmails } from "@/server/email/outbox";

/** Called by a scheduler (Netlify Scheduled Function or cron) with `Authorization: Bearer <CRON_SECRET>`. */
export async function POST(req: Request) {
  const secret = getConfig().cronSecret;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  const results = await processDueEmails({ limit: 10 }); // stays well inside serverless time limits
  return Response.json({ processed: results.length, results });
}
