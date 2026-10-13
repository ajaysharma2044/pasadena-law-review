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

/**
 * Client IP for rate limiting, read only from the header the host's proxy sets (TRUSTED_IP_HEADER).
 * In an X-Forwarded-For chain only the last entry was added by our own proxy; earlier ones are the client's word.
 */
export function clientIp(headers: Headers): string {
  const name = getConfig().trustedIpHeader;
  const value = headers.get(name);
  if (!value) return "unknown";
  const ip = name === "x-forwarded-for" ? value.split(",").at(-1) : value;
  return ip?.trim() || "unknown";
}
