import type { Metadata } from "next";
import { AdminNav } from "@/components/admin-nav";
import { Flash, FormNav, Page, flashFrom, formatDateTime, type SearchParams } from "@/components/ui";
import { listMembers } from "@/server/services/members";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ searchParams }: { searchParams: SearchParams }) {
  const { notice, error, one } = await flashFrom(searchParams);
  const filters = { q: one("q") ?? "", role: one("role") ?? "", status: one("status") ?? "" };
  const members = await listMembers(filters);
  const back = `/admin/members?${new URLSearchParams(filters).toString()}`;
  return (
    <Page title="Members" wide>
      <AdminNav current="/admin/members" />
      <Flash notice={notice} error={error} />
      <form className="actions" method="get" action="/admin/members" role="search">
        <label className="sr-only" htmlFor="q">Search by name or email</label>
        <input id="q" name="q" type="search" placeholder="Name or email" defaultValue={filters.q} className="w-medium" />
        <label className="sr-only" htmlFor="role">Role</label>
        <select id="role" name="role" defaultValue={filters.role} className="w-narrow">
          <option value="">Any role</option>
          <option value="member">Members</option>
          <option value="editor">Editors</option>
          <option value="admin">Administrators</option>
        </select>
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={filters.status} className="w-narrow">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="pending">Waiting for approval</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="button" type="submit">Filter</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Members</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Joined</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.email}{m.emailVerified ? "" : " (unconfirmed)"}</td>
                <td>{m.role}</td>
                <td>
                  {m.status}
                  {m.statusReason ? <span className="hint"> {m.statusReason}</span> : null}
                </td>
                <td>{formatDateTime(m.createdAt)}</td>
                <td>
                  <form method="post" action={`/api/admin/members/${m.id}/role`} className="actions tight">
                    <FormNav back={back} next={back} />
                    <label className="sr-only" htmlFor={`role-${m.id}`}>Role for {m.name}</label>
                    <select id={`role-${m.id}`} name="role" defaultValue={m.role} className="w-narrow">
                      <option value="member">Member</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Administrator</option>
                    </select>
                    <button className="button" type="submit">Set role</button>
                  </form>
                  <form method="post" action={`/api/admin/members/${m.id}/status`} className="actions below">
                    <FormNav back={back} next={back} />
                    <input type="hidden" name="status" value={m.status === "active" ? "suspended" : "active"} />
                    {m.status === "active" ? (
                      <>
                        <label className="sr-only" htmlFor={`reason-${m.id}`}>Reason for suspending {m.name}</label>
                        <input id={`reason-${m.id}`} name="reason" type="text" placeholder="Reason" maxLength={300} className="w-narrow" />
                        <button className="button button-danger" type="submit">Suspend</button>
                      </>
                    ) : (
                      <button className="button" type="submit">{m.status === "pending" ? "Approve" : "Reactivate"}</button>
                    )}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {members.length === 0 ? <p className="empty">No members match.</p> : null}
    </Page>
  );
}
