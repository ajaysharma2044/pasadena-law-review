import { AdminNav } from "@/components/admin-nav";
import { Page, Flash, FormNav, flashFrom, type SearchParams } from "@/components/ui";
import { pageAccess } from "@/server/session";
import { listMembers } from "@/server/services/members";
import { allAwards, BADGES, keys } from "@/server/services/badges";

export default async function BadgeAdmin({searchParams}:{searchParams:SearchParams}) {
 const access=await pageAccess("/admin/badges",["admin"]);
 if(!access.ok) return null;
 const [members,awards,flash]=await Promise.all([listMembers(access.actor,{}),allAwards(access.actor),flashFrom(searchParams)]);
 return <Page title="Contributor recognition" wide lede="Administrator-issued badges; these do not grant permissions or elected club offices.">
  <AdminNav current="/admin/badges"/><Flash notice={flash.notice} error={flash.error}/>
  <p>Verify claims before awarding. The President is Editor-in-Chief under the constitution; badges never appoint officers. Member privacy preferences must be respected.</p>
  <form className="form" action="/api/admin/badges" method="post">
   <FormNav back="/admin/badges" next="/admin/badges"/>
   <div className="field"><label htmlFor="badge-user">Member</label><select id="badge-user" name="userId" required>
    <option value="">Select account</option>{members.map(m=><option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
   </select></div>
   <div className="field"><label htmlFor="badge-key">Badge</label><select id="badge-key" name="badgeKey">
    {keys.map(k=><option key={k} value={k}>{BADGES[k]}</option>)}
   </select></div>
   <div className="field"><label htmlFor="badge-reason">Evidence / rationale</label><input id="badge-reason" name="reason" maxLength={300}/></div>
   <div className="field"><label htmlFor="badge-action">Action</label><select id="badge-action" name="action"><option value="award">Award</option><option value="revoke">Revoke</option></select></div>
   <button className="button button-primary" type="submit">Save</button>
  </form>
  <h2>Current awards</h2><ul>{awards.map(a=><li key={a.userId+a.key}>{a.name} ({a.email}): {BADGES[a.key as keyof typeof BADGES]??a.key}</li>)}</ul>
 </Page>;
}
