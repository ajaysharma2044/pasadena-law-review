import { sql } from "drizzle-orm";
import { getConfig } from "./config";
import { getDb } from "./db/client";
import { tooMany } from "./errors";

/**
 * Fixed-window counter stored in Postgres, so limits hold across server instances and restarts.
 * Throws a 429 AppError when the limit is exceeded.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  if (!getConfig().rateLimits) return;
  const result = await getDb().execute<{ count: number; window_start: Date | string }>(sql`
    insert into app_rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when app_rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   then 1 else app_rate_limits.count + 1 end,
      window_start = case when app_rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   then now() else app_rate_limits.window_start end
    returning count, window_start`);
  const row = result.rows[0];
  if (row && row.count > limit) {
    const started = new Date(row.window_start).getTime();
    throw tooMany(Math.max(1, Math.round((started + windowSeconds * 1000 - Date.now()) / 1000)));
  }
}

/** Client IP for rate limiting. Netlify sets x-nf-client-connection-ip; other proxies set x-forwarded-for. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
