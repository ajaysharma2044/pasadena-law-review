import type { Metadata } from "next";
import { AdminNav } from "@/components/admin-nav";
import { AccessDenied, Flash, FormNav, Page, flashFrom, formatDateTime, type SearchParams } from "@/components/ui";
import { listApplications } from "@/server/services/applications";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Editor applications" };

export default async function ApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await pageAccess("/admin/applications", ["admin"]);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  const { notice, error, one } = await flashFrom(searchParams);
  const status = one("status") ?? "pending";
  const apps = await listApplications(access.actor, status === "all" ? undefined : status);
  const back = `/admin/applications?status=${status}`;
  return (
    <Page title="Editor applications" wide>
      <AdminNav current="/admin/applications" />
      <Flash notice={notice} error={error} />
      <form className="actions" method="get" action="/admin/applications">
        <label htmlFor="status" className="label-text">Show</label>
        <select id="status" name="status" defaultValue={status} className="w-narrow">
          <option value="pending">Waiting for a decision</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="all">All</option>
        </select>
        <button className="button" type="submit">Show</button>
      </form>
      {apps.length === 0 ? <p className="empty">No applications here.</p> : null}
      {apps.map((a) => (
        <section key={a.id} className="panel" aria-label={`Application from ${a.name}`}>
          <h2>{a.name}</h2>
          <p className="byline">
            {a.email} · applied {formatDateTime(a.createdAt)} · {a.status}
          </p>
          <h3>Why they want to edit</h3>
          <p className="pre-wrap">{a.statement}</p>
          {a.experience ? (
            <>
              <h3>Experience</h3>
              <p className="pre-wrap">{a.experience}</p>
            </>
          ) : null}
          {a.status === "pending" ? (
            <form className="form" method="post" action={`/api/admin/applications/${a.id}/decision`}>
              <FormNav back={back} next={back} />
              <div className="field">
                <label htmlFor={`note-${a.id}`}>Note to the applicant (optional)</label>
                <textarea id={`note-${a.id}`} name="note" maxLength={2000} />
              </div>
              <div className="actions">
                <button className="button button-primary" type="submit" name="decision" value="approve">Approve as editor</button>
                <button className="button button-danger" type="submit" name="decision" value="decline">Decline</button>
              </div>
            </form>
          ) : a.decisionNote ? (
            <p>Decision note: {a.decisionNote}</p>
          ) : null}
        </section>
      ))}
    </Page>
  );
}
