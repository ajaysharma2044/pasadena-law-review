import type { Metadata } from "next";
import { formatDate, formatMeetingTime, getNextMeeting, getPublishedPage, listPastMinutes } from "@/server/services/public-content";

export const metadata: Metadata = { title: "Meetings" };

export default async function MeetingsPage() {
  const [intro, next, minutes] = await Promise.all([getPublishedPage("meetings_intro"), getNextMeeting(), listPastMinutes()]);
  return (
    <main id="content">
      <div className="page-head narrow">
        <h1>Meetings</h1>
      </div>
      <div className="page narrow">
        <div className="prose">
          <h2>Next meeting</h2>
          {next && next.startsAt ? (
            <dl className="facts">
              <dt>When</dt>
              <dd>{formatMeetingTime(next.startsAt, next.timezone)}</dd>
              {next.location ? (
                <>
                  <dt>Where</dt>
                  <dd>{next.location}</dd>
                </>
              ) : null}
              {next.motion ? (
                <>
                  <dt>Motion</dt>
                  <dd>{next.motion}</dd>
                </>
              ) : null}
              {next.openerFor || next.openerAgainst ? (
                <>
                  <dt>Openers</dt>
                  <dd>
                    {next.openerFor ? `For: ${next.openerFor}. ` : ""}
                    {next.openerAgainst ? `Against: ${next.openerAgainst}.` : ""}
                  </dd>
                </>
              ) : null}
              {next.attendancePolicy ? (
                <>
                  <dt>Open to</dt>
                  <dd>{next.attendancePolicy}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="empty">No meeting has been announced yet.</p>
          )}
          {intro ? <div dangerouslySetInnerHTML={{ __html: intro.html }} /> : null}
          <h2>Minutes</h2>
          {minutes.length === 0 ? (
            <p className="empty">No minutes have been published yet.</p>
          ) : (
            minutes.map((m) => (
              <section key={m.id} aria-label={`Minutes, ${m.startsAt ? formatDate(m.startsAt, m.timezone) : ""}`}>
                <h3>{m.startsAt ? formatDate(m.startsAt, m.timezone) : "Meeting"}</h3>
                {m.motion ? <p className="meta">{m.motion}</p> : null}
                <div dangerouslySetInnerHTML={{ __html: m.minutesHtml }} />
              </section>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
