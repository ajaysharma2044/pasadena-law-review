import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { AdminNav } from "@/components/admin-nav";
import { Flash, FormNav, Page, flashFrom, type SearchParams } from "@/components/ui";
import { getDb } from "@/server/db/client";
import { publications, publicationVersions } from "@/server/db/schema";
import { listMastheadAdmin } from "@/server/services/cms";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const { notice, error } = await flashFrom(searchParams);
  const [s, masthead, live] = await Promise.all([
    getSettings(),
    listMastheadAdmin(),
    getDb()
      .select({ id: publications.id, title: publicationVersions.title })
      .from(publications)
      .innerJoin(publicationVersions, eq(publicationVersions.id, publications.currentVersionId))
      .where(eq(publications.state, "live")),
  ]);
  const rows = Array.from({ length: 12 }, (_, i) => masthead[i] ?? { roleTitle: "", personName: "" });
  const back = "/admin/settings";
  return (
    <Page title="Settings" wide>
      <AdminNav current="/admin/settings" />
      <Flash notice={notice} error={error} />
      <form className="form" method="post" action="/api/admin/settings">
        <FormNav back={back} next={back} />
        <div className="field">
          <label htmlFor="publication_name">Publication name</label>
          <input id="publication_name" name="publication_name" type="text" required maxLength={120} defaultValue={s.publication_name} />
        </div>
        <div className="field">
          <label htmlFor="publication_tagline">Line above the name</label>
          <input id="publication_tagline" name="publication_tagline" type="text" maxLength={200} defaultValue={s.publication_tagline} />
        </div>
        <div className="field">
          <label htmlFor="nameplate_issue_line">Line below the name</label>
          <input id="nameplate_issue_line" name="nameplate_issue_line" type="text" maxLength={120} defaultValue={s.nameplate_issue_line} />
        </div>
        <div className="field">
          <label htmlFor="contact_email">Public contact email</label>
          <input id="contact_email" name="contact_email" type="email" maxLength={200} defaultValue={s.contact_email} aria-describedby="contact-hint" />
          <p className="hint" id="contact-hint">Shown on the About page and in the footer. Leave empty until the inbox exists.</p>
        </div>
        <div className="field">
          <label htmlFor="instagram_handle">Instagram handle</label>
          <input id="instagram_handle" name="instagram_handle" type="text" maxLength={60} defaultValue={s.instagram_handle} />
        </div>
        <div className="field">
          <label htmlFor="timezone">Publication time zone</label>
          <input id="timezone" name="timezone" type="text" required defaultValue={s.timezone} />
        </div>
        <div className="field">
          <label htmlFor="front_lead_publication_id">Front-page lead</label>
          <select id="front_lead_publication_id" name="front_lead_publication_id" defaultValue={s.front_lead_publication_id ?? ""}>
            <option value="">Most recent publication</option>
            {live.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="submission_deadline_note">Deadline note on the Submissions page</label>
          <input id="submission_deadline_note" name="submission_deadline_note" type="text" maxLength={300} defaultValue={s.submission_deadline_note} />
        </div>
        <div className="checkbox">
          <input type="checkbox" id="submissions_open" name="submissions_open" defaultChecked={s.submissions_open} />
          <label htmlFor="submissions_open">Accept new submissions</label>
        </div>
        <div className="checkbox">
          <input type="checkbox" id="membership_requires_approval" name="membership_requires_approval" defaultChecked={s.membership_requires_approval} />
          <label htmlFor="membership_requires_approval">New accounts need an administrator’s approval before they can submit (reading never needs an account)</label>
        </div>
        <button className="button button-primary" type="submit">Save settings</button>
      </form>

      <h2>Masthead</h2>
      <p>The masthead page stays hidden until you publish a list of real, appointed people.</p>
      <form className="form" method="post" action="/api/admin/masthead">
        <FormNav back={back} next={back} />
        <table className="table">
          <caption className="sr-only">Masthead entries</caption>
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Name</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <label className="sr-only" htmlFor={`role_${i}`}>Role {i + 1}</label>
                  <input id={`role_${i}`} name={`role_${i}`} type="text" maxLength={120} defaultValue={r.roleTitle} />
                </td>
                <td>
                  <label className="sr-only" htmlFor={`name_${i}`}>Name {i + 1}</label>
                  <input id={`name_${i}`} name={`name_${i}`} type="text" maxLength={120} defaultValue={r.personName} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="checkbox">
          <input type="checkbox" id="publish" name="publish" defaultChecked={s.masthead_published} />
          <label htmlFor="publish">Publish the masthead page</label>
        </div>
        <button className="button" type="submit">Save masthead</button>
      </form>
    </Page>
  );
}
