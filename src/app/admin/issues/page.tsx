import type { Metadata } from "next";
import { AdminNav } from "@/components/admin-nav";
import { AccessDenied, Flash, FormNav, Page, flashFrom, type SearchParams } from "@/components/ui";
import { listIssuesAdmin, listVolumes } from "@/server/services/cms";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Issues" };

export default async function IssuesAdmin({ searchParams }: { searchParams: SearchParams }) {
  const access = await pageAccess("/admin/issues", ["admin"]);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  const { notice, error } = await flashFrom(searchParams);
  const [issueRows, vols] = await Promise.all([listIssuesAdmin(access.actor), listVolumes(access.actor)]);
  const back = "/admin/issues";
  return (
    <Page title="Volumes and issues" lede="An issue appears on the Journal page only when it’s marked visible." wide>
      <AdminNav current="/admin/issues" />
      <Flash notice={notice} error={error} />
      <table className="table">
        <caption className="sr-only">Issues</caption>
        <thead>
          <tr>
            <th scope="col">Issue</th>
            <th scope="col">Live pieces</th>
            <th scope="col">Edit</th>
          </tr>
        </thead>
        <tbody>
          {issueRows.map((i) => (
            <tr key={i.id}>
              <td>
                {i.volumeLabel} ({i.yearLabel}), Number {i.number}
              </td>
              <td>{i.livePieces}</td>
              <td>
                <form className="actions tight" method="post" action="/api/admin/issues">
                  <FormNav back={back} next={back} />
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="volumeId" value={i.volumeId} />
                  <label className="sr-only" htmlFor={`n-${i.id}`}>Number</label>
                  <input id={`n-${i.id}`} name="number" type="number" min={1} defaultValue={i.number} className="w-narrow" />
                  <label className="sr-only" htmlFor={`t-${i.id}`}>Term</label>
                  <input id={`t-${i.id}`} name="termLabel" type="text" defaultValue={i.termLabel} className="w-narrow" />
                  <label className="sr-only" htmlFor={`o-${i.id}`}>Order</label>
                  <input id={`o-${i.id}`} name="sortOrder" type="number" defaultValue={i.sortOrder} className="w-narrow" />
                  <span className="checkbox">
                    <input type="checkbox" id={`v-${i.id}`} name="visible" defaultChecked={i.visible} />
                    <label htmlFor={`v-${i.id}`}>Visible</label>
                  </span>
                  <button className="button" type="submit">Save</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Add an issue</h2>
      <form className="form" method="post" action="/api/admin/issues">
        <FormNav back={back} next={back} />
        <div className="field">
          <label htmlFor="volumeId">Volume</label>
          <select id="volumeId" name="volumeId" required>
            {vols.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="number">Number</label>
          <input id="number" name="number" type="number" min={1} required />
        </div>
        <div className="field">
          <label htmlFor="termLabel">Term</label>
          <input id="termLabel" name="termLabel" type="text" placeholder="Spring 2027" required />
        </div>
        <input type="hidden" name="sortOrder" value="0" />
        <button className="button" type="submit">Add issue (hidden)</button>
      </form>

      <h2>Add a volume</h2>
      <form className="form" method="post" action="/api/admin/issues">
        <FormNav back={back} next={back} />
        <input type="hidden" name="action" value="create_volume" />
        <div className="field">
          <label htmlFor="vnumber">Volume number</label>
          <input id="vnumber" name="number" type="number" min={1} required />
        </div>
        <div className="field">
          <label htmlFor="label">Label</label>
          <input id="label" name="label" type="text" placeholder="Volume II" />
        </div>
        <div className="field">
          <label htmlFor="yearLabel">Academic year</label>
          <input id="yearLabel" name="yearLabel" type="text" placeholder="2027–28" />
        </div>
        <button className="button" type="submit">Add volume</button>
      </form>
    </Page>
  );
}
