import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied, Flash, Page, STATUS_LABEL, flashFrom, formatDateTime, type SearchParams } from "@/components/ui";
import { KIND_LABEL } from "@/server/services/public-content";
import { listMine } from "@/server/services/manuscripts";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Your dashboard", robots: { index: false } };

export default async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const { notice, error } = await flashFrom(searchParams);
  const access = await pageAccess("/dashboard");
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  const items = await listMine(access.actor);
  return (
    <Page title="Your submissions">
      <Flash notice={notice} error={error} />
      <p>
        <Link className="button button-primary" href="/manuscripts/new">Start a submission</Link>
      </p>
      {items.length === 0 ? (
        <p className="empty">You haven’t started anything yet. Read the <Link href="/submissions">guidelines</Link> first.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Your submissions</caption>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Last change</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/manuscripts/${m.id}`}>{m.title || "Untitled draft"}</Link>
                  </td>
                  <td>{KIND_LABEL[m.kind]}</td>
                  <td>
                    <span className="status">{STATUS_LABEL[m.status]}</span>
                  </td>
                  <td>{formatDateTime(m.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
