/** Hourly roster mirror; production scheduled functions only. */
export default async () => {
  const base = process.env.APP_URL ?? process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("Scheduler configuration missing", { status: 500 });
  const response = await fetch(`${base}/api/jobs/member-sheet-sync`, {
    method: "POST", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(55_000),
  });
  return new Response(`Member sync answered ${response.status}`, { status: response.ok ? 200 : 502 });
};

export const config = { schedule: "0 * * * *" };
