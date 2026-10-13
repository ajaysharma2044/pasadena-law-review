import type { Metadata } from "next";
import { AdminNav } from "@/components/admin-nav";
import { AccessDenied, Page, formatDateTime } from "@/components/ui";
import { listAuditEvents } from "@/server/services/admin";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const access = await pageAccess("/admin/audit", ["admin"]);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  const rows = await listAuditEvents(access.actor);
  return (
    <Page title="Audit log" lede="The last 200 recorded actions. Entries can’t be edited or deleted." wide>
      <AdminNav current="/admin/audit" />
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Audit events</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">Action</th>
              <th scope="col">Target</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDateTime(r.createdAt)}</td>
                <td>{r.actor ?? "system"}</td>
                <td>{r.action}</td>
                <td>
                  {r.targetType} {r.targetId.slice(0, 8)}
                </td>
                <td>{Object.entries(r.metadata as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
