import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { AdminNav } from "@/components/admin-nav";
import { Page, formatDateTime } from "@/components/ui";
import { getDb } from "@/server/db/client";
import { auditEvents, user } from "@/server/db/schema";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const rows = await getDb()
    .select({ id: auditEvents.id, action: auditEvents.action, targetType: auditEvents.targetType, targetId: auditEvents.targetId, metadata: auditEvents.metadata, createdAt: auditEvents.createdAt, actor: user.name })
    .from(auditEvents)
    .leftJoin(user, eq(user.id, auditEvents.actorId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(200);
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
