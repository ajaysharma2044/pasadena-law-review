/**
 * Netlify Scheduled Function: every five minutes, asks the app to deliver queued and retryable email.
 * The job runner requires CRON_SECRET, so nothing else can trigger it.
 */
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("URL or CRON_SECRET not set", { status: 500 });
  const res = await fetch(`${base}/api/jobs/run`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  return new Response(`job runner answered ${res.status}`, { status: res.ok ? 200 : 502 });
};

export const config = { schedule: "*/5 * * * *" };
