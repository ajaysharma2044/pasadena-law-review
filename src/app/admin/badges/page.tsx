import { AdminNav } from "@/components/admin-nav";
import { AccessDenied, Page, Flash, FormNav, flashFrom, type SearchParams } from "@/components/ui";
import { pageAccess } from "@/server/session";
import { listMembers } from "@/server/services/members";
import { allAwards, BADGES, BADGE_CRITERIA, keys } from "@/server/services/badges";

export default async function BadgeAdmin({searchParams}:{searchParams:SearchParams}) {
 const access=await pageAccess("/admin/badges",["admin"]);
 if(!access.ok) return <AccessDenied reason={access.reason}/>;
 const flash = await flashFrom(searchParams);
 const q = (flash.one("q") ?? "").slice(0,120);
 const [members,awards]=await Promise.all([listMembers(access.actor,{q}),allAwards(access.actor)]);
 return <Page title="Contributor recognition" wide lede="Administrator-issued badges; these do not grant permissions or elected club offices.">
  <AdminNav current="/admin/badges"/><Flash notice={flash.notice} error={flash.error}/>
  <p>Verify claims before awarding. The President is Editor-in-Chief under the constitution; badges never appoint officers. Member privacy preferences must be respected.</p>
  <form method="get" action="/admin/badges" className="actions" role="search">
   <label htmlFor="badge-search">Search registered users</label>
   <input id="badge-search" name="q" type="search" defaultValue={q} placeholder="Name or email" maxLength={120}/>
   <button className="button" type="submit">Search</button>
  </form>
  <p>Showing up to 200 matching accounts. Search by email to narrow the selection. <a href="/recognition">Recognition criteria</a></p>
  <form className="form" action="/api/admin/badges" method="post">
   <FormNav back={`/admin/badges?q=${encodeURIComponent(q)}`} next={`/admin/badges?q=${encodeURIComponent(q)}`}/>
   <div className="field"><label htmlFor="badge-user">Member</label><select id="badge-user" name="userId" required>
    <option value="">Select account</option>{members.map(m=><option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
   </select></div>
   <div className="field"><label htmlFor="badge-key">Badge</label><select id="badge-key" name="badgeKey">
    {keys.map(k=><option key={k} value={k}>{BADGES[k]}</option>)}
   </select></div>
   <div className="field"><label htmlFor="badge-reason">Evidence / rationale</label><input id="badge-reason" name="reason" maxLength={300} required/></div>
   <label><input type="checkbox" name="appointmentConfirmed"/> For an Editorial Board award, I verified an existing authorized editorial appointment. This badge does not appoint an officer.</label>
   <div className="field"><label htmlFor="badge-action">Action</label><select id="badge-action" name="action"><option value="award">Award</option><option value="revoke">Revoke</option></select></div>
   <button className="button button-primary" type="submit">Save</button>
  </form>
  <details><summary>Badge criteria</summary><dl>{keys.map(k=><div key={k}><dt>{BADGES[k]}</dt><dd>{BADGE_CRITERIA[k]}</dd></div>)}</dl></details>
  <h2>Current awards</h2><ul>{awards.map(a=><li key={a.userId+a.key}>{a.name} ({a.email}): {BADGES[a.key as keyof typeof BADGES]??a.key}</li>)}</ul>
 </Page>;
}
