import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ManuscriptBody } from "@/components/manuscript-editor";
import { EditorNav } from "@/components/editor-nav";
import { AccessDenied, Flash, FormNav, Page, flashFrom, type SearchParams } from "@/components/ui";
import { getMeeting, utcToLocalInput } from "@/server/services/cms";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Meeting" };

type Props = { params: Promise<{ id: string }>; searchParams: SearchParams };

export default async function MeetingForm({ params, searchParams }: Props) {
  const { id } = await params;
  const access = await pageAccess(`/editor/meetings/${encodeURIComponent(id)}`, ["editor", "admin"]);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  const { notice, error } = await flashFrom(searchParams);
  const actor = access.actor;
  const isNew = id === "new";
  const m = isNew ? null : await getMeeting(actor, id);
  if (!isNew && !m) notFound();
  const tz = m?.timezone ?? "America/Los_Angeles";
  const isAdmin = actor.role === "admin";
  const locked = !isAdmin && m && (m.status !== "draft" || m.minutesPublished);
  const back = isNew ? "/editor/meetings/new" : `/editor/meetings/${id}`;
  return (
    <Page title={isNew ? "New meeting" : "Meeting"}>
      <EditorNav current="/editor/meetings" />
      <Flash notice={notice} error={error} />
      {locked ? <p className="notice">This meeting is public, so only an administrator can change it.</p> : null}
      <form className="form" method="post" action="/api/meetings">
        <FormNav back={back} />
        {m ? (
          <>
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="expectedVersion" value={m.version} />
          </>
        ) : null}
        <fieldset disabled={Boolean(locked)}>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={m?.status ?? "draft"} aria-describedby="status-hint">
              <option value="draft">Draft (not public)</option>
              <option value="announced" disabled={!isAdmin}>Announced (public)</option>
              <option value="held" disabled={!isAdmin}>Held</option>
              <option value="cancelled" disabled={!isAdmin}>Cancelled</option>
            </select>
            {!isAdmin ? <p className="hint" id="status-hint">An administrator announces the meeting when the details are final.</p> : null}
          </div>
          <div className="field">
            <label htmlFor="startsAtLocal">Date and time</label>
            <input id="startsAtLocal" name="startsAtLocal" type="datetime-local" defaultValue={utcToLocalInput(m?.startsAt ?? null, tz)} />
          </div>
          <div className="field">
            <label htmlFor="timezone">Time zone</label>
            <input id="timezone" name="timezone" type="text" defaultValue={tz} required aria-describedby="tz-hint" />
            <p className="hint" id="tz-hint">For PCC this is America/Los_Angeles.</p>
          </div>
          <div className="field">
            <label htmlFor="location">Building and room</label>
            <input id="location" name="location" type="text" maxLength={300} defaultValue={m?.location ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="motion">Motion</label>
            <textarea id="motion" name="motion" maxLength={1000} defaultValue={m?.motion ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="openerFor">Opening speaker for</label>
            <input id="openerFor" name="openerFor" type="text" maxLength={200} defaultValue={m?.openerFor ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="openerAgainst">Opening speaker against</label>
            <input id="openerAgainst" name="openerAgainst" type="text" maxLength={200} defaultValue={m?.openerAgainst ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="attendancePolicy">Who can come</label>
            <input id="attendancePolicy" name="attendancePolicy" type="text" maxLength={300} defaultValue={m?.attendancePolicy ?? ""} />
          </div>
          <ManuscriptBody name="minutesMd" label="Minutes" defaultValue={m?.minutesMd ?? ""} />
          <div className="checkbox">
            <input type="checkbox" id="minutesPublished" name="minutesPublished" defaultChecked={m?.minutesPublished ?? false} disabled={!isAdmin} />
            <label htmlFor="minutesPublished">Publish the minutes on the Meetings page{isAdmin ? "" : " (administrators only)"}</label>
          </div>
          <button className="button button-primary" type="submit">Save meeting</button>
        </fieldset>
      </form>
    </Page>
  );
}
