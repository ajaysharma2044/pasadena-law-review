import { and, count, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { Page } from "@/components/ui";
import { getDb } from "@/server/db/client";
import { cmsPageVersions, editorialApplications, emailJobs, manuscripts, memberships } from "@/server/db/schema";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminHome() {
  const db = getDb();
  const [[apps], [waiting], [pendingMembers], [failedMail], [proposals]] = await Promise.all([
    db.select({ n: count() }).from(editorialApplications).where(eq(editorialApplications.status, "pending")),
    db.select({ n: count() }).from(manuscripts).where(inArray(manuscripts.status, ["submitted", "in_review", "resubmitted", "accepted"])),
    db.select({ n: count() }).from(memberships).where(eq(memberships.status, "pending")),
    db.select({ n: count() }).from(emailJobs).where(and(inArray(emailJobs.status, ["failed", "bounced", "complained"]))),
    db.select({ n: count() }).from(cmsPageVersions).where(eq(cmsPageVersions.status, "proposed")),
  ]);
  const rows: [string, number, string][] = [
    ["Manuscripts in the editorial process", waiting.n, "/admin/manuscripts"],
    ["Editor applications waiting for a decision", apps.n, "/admin/applications"],
    ["Accounts waiting for approval", pendingMembers.n, "/admin/members?status=pending"],
    ["Page changes proposed by editors", proposals.n, "/admin/pages"],
    ["Emails that failed or bounced", failedMail.n, "/admin/email?status=problem"],
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
