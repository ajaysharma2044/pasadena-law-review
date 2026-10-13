import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { AccessDenied, Page } from "@/components/ui";
import { adminOverview } from "@/server/services/admin";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminHome() {
  const access = await pageAccess("/admin", ["admin"]);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  const n = await adminOverview(access.actor);
  const rows: [string, number, string][] = [
    ["Manuscripts in the editorial process", n.inProcess, "/admin/manuscripts"],
    ["Editor applications waiting for a decision", n.applications, "/admin/applications"],
    ["Accounts waiting for approval", n.pendingMembers, "/admin/members?status=pending"],
    ["Page changes proposed by editors", n.proposals, "/admin/pages"],
    ["Emails that failed or bounced", n.failedMail, "/admin/email?status=problem"],
  ];
  return (
    <Page title="Administration" wide>
      <AdminNav current="/admin" />
      <table className="table">
        <caption className="sr-only">Things waiting for an administrator</caption>
        <tbody>
          {rows.map(([label, n, href]) => (
            <tr key={href}>
              <th scope="row">{label}</th>
              <td>{n}</td>
              <td>
                <Link href={href}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}
