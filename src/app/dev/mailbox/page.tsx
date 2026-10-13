import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page, formatDateTime } from "@/components/ui";
import { getConfig } from "@/server/config";
import { getDb } from "@/server/db/client";
import { emailJobs } from "@/server/db/schema";

export const metadata: Metadata = { title: "Development mailbox", robots: { index: false } };

/** Development only: shows mail the dev transport "sent". Absent in production. */
export default async function DevMailbox() {
  const config = getConfig();
  if (config.strict || config.email.transport !== "dev") notFound();
  const jobs = await getDb().select().from(emailJobs).orderBy(desc(emailJobs.createdAt)).limit(50);
  return (
    <Page title="Development mailbox" lede="Messages the development transport would have sent. Nothing here left this computer.">
      {jobs.length === 0 ? <p className="empty">No messages yet.</p> : null}
      {jobs.map((j) => (
        <section key={j.id} className="panel" aria-label={j.subject}>
          <h2>{j.subject}</h2>
          <p className="byline">
            To {j.toEmail} · {formatDateTime(j.createdAt)} · {j.status}
          </p>
          <pre className="mailbox-body">{j.textBody}</pre>
        </section>
      ))}
    </Page>
  );
}
