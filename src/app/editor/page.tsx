import type { Metadata } from "next";
import Link from "next/link";
import { EditorNav } from "@/components/editor-nav";
import { AccessDenied, Flash, Page, STATUS_LABEL, flashFrom, formatDateTime, type SearchParams } from "@/components/ui";
import { KIND_LABEL } from "@/server/services/public-content";
import { listQueue } from "@/server/services/manuscripts";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Review queue" };

export default async function Queue({ searchParams }: { searchParams: SearchParams }) {
  const access = await pageAccess("/editor", ["editor", "admin"]);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  const { notice, error, one } = await flashFrom(searchParams);
  const actor = access.actor;
  const filters = { kind: one("kind") ?? "", status: one("status") ?? "", assignment: one("assignment") ?? "all" };
  const items = await listQueue(actor, filters);
  return (
    <Page title="Review queue" wide>
      <EditorNav current="/editor" />
      <Flash notice={notice} error={error} />
      <form className="actions" method="get" action="/editor">
        <label className="sr-only" htmlFor="assignment">Assignment</label>
        <select id="assignment" name="assignment" defaultValue={filters.assignment} className="w-narrow">
          <option value="all">All</option>
          <option value="mine">Assigned to me</option>
          <option value="unassigned">No reviewer yet</option>
        </select>
        <label className="sr-only" htmlFor="kind">Kind</label>
        <select id="kind" name="kind" defaultValue={filters.kind} className="w-narrow">
          <option value="">Any kind</option>
          <option value="essay">Essays</option>
          <option value="proposal">Proposals</option>
          <option value="note">Notes</option>
          <option value="forum">Forum</option>
        </select>
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={filters.status} className="w-narrow">
          <option value="">In progress</option>
          <option value="submitted">Submitted</option>
          <option value="in_review">In review</option>
          <option value="resubmitted">Resubmitted</option>
          <option value="changes_requested">Changes requested</option>
          <option value="accepted">Accepted</option>
          <option value="published">Published</option>
          <option value="declined">Declined</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="all">Everything</option>
        </select>
        <button className="button" type="submit">Filter</button>
      </form>
      {items.length === 0 ? (
        <p className="empty">Nothing matches.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Manuscripts</caption>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Kind</th>
                <th scope="col">Status</th>
                <th scope="col">Reviewers</th>
                <th scope="col">Recommendations on current version</th>
                <th scope="col">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/editor/manuscripts/${m.id}`}>{m.title || "Untitled"}</Link>
                    {m.attributionNote ? <span className="hint"> (imported; author not confirmed)</span> : null}
                  </td>
                  <td>{KIND_LABEL[m.kind]}</td>
                  <td>
                    <span className="status">{STATUS_LABEL[m.status]}</span>
                  </td>
                  <td>{m.reviewers}</td>
                  <td>{m.recommendations} of 2</td>
                  <td>{formatDateTime(m.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
