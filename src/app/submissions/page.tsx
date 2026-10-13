import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPage } from "@/server/services/public-content";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Submissions" };

export default async function SubmissionsPage() {
  const [page, settings] = await Promise.all([getPublishedPage("submissions"), getSettings()]);
  return (
    <main id="content">
      <div className="page-head narrow">
        <h1>Submissions</h1>
        <p>
          {settings.submissions_open ? (
            <>
              Submit through your account. <Link href="/manuscripts/new">Start a submission</Link>, or{" "}
              <Link href="/signup">create an account</Link> first.
            </>
          ) : (
            "The Journal is not reading new submissions right now."
          )}
          {settings.submission_deadline_note ? ` ${settings.submission_deadline_note}` : ""}
        </p>
      </div>
      <div className="page narrow">
        <div className="prose">
          {page ? <div dangerouslySetInnerHTML={{ __html: page.html }} /> : <p className="empty">Guidelines are being written.</p>}
        </div>
      </div>
    </main>
  );
}
