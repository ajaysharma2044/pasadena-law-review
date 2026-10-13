import type { Metadata } from "next";
import { AdminNav } from "@/components/admin-nav";
import { AccessDenied, Flash, FormNav, Page, flashFrom, formatDateTime, type SearchParams } from "@/components/ui";
import { getConfig } from "@/server/config";
import { listEmailJobs } from "@/server/services/admin";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Email" };

const STATUS_TEXT = {
  queued: "Queued (not sent yet)",
  sending: "Sending",
  accepted: "Accepted by the provider",
  delivered: "Delivered",
  bounced: "Bounced",
  complained: "Marked as spam",
  failed: "Failed",
} as const;

export default async function EmailPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await pageAccess("/admin/email", ["admin"]);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  const { notice, error, one } = await flashFrom(searchParams);
  const jobs = await listEmailJobs(access.actor, one("status") === "problem");
  const config = getConfig();
  return (
    <Page title="Email" wide>
      <AdminNav current="/admin/email" />
      <Flash notice={notice} error={error} />
      <p>
        Sending with: <strong>{config.email.transport === "resend" ? "Resend" : "the development mailbox (nothing is really sent)"}</strong>.{" "}
        {config.email.transport === "resend" && !config.email.webhookSecret
          ? "Delivery confirmations aren’t set up, so “Accepted” is the furthest status shown."
          : null}
      </p>
      <p>
        <a href="/admin/email">All</a> · <a href="/admin/email?status=problem">Problems only</a>
      </p>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Email jobs</caption>
          <thead>
            <tr>
              <th scope="col">To</th>
              <th scope="col">Subject</th>
              <th scope="col">Status</th>
              <th scope="col">Attempts</th>
              <th scope="col">Updated</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.toEmail}</td>
                <td>{j.subject}</td>
                <td>
                  {STATUS_TEXT[j.status]}
                  {j.lastError ? <span className="hint"> {j.lastError}</span> : null}
                </td>
                <td>{j.attempts}</td>
                <td>{formatDateTime(j.updatedAt)}</td>
                <td>
                  {j.status === "failed" ? (
                    <form method="post" action={`/api/admin/email/${j.id}/retry`}>
                      <FormNav back="/admin/email" next="/admin/email" />
                      <button className="button" type="submit">Retry</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {jobs.length === 0 ? <p className="empty">Nothing here.</p> : null}
    </Page>
  );
}
