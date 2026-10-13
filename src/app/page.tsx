import Link from "next/link";
import {
  KIND_LABEL,
  formatMeetingTime,
  getFrontLead,
  getNextMeeting,
  getPublishedPage,
} from "@/server/services/public-content";
import { getSettings } from "@/server/services/settings";

export default async function FrontPage() {
  const [settings, lead, meeting, note] = await Promise.all([
    getSettings(),
    getFrontLead(),
    getNextMeeting(),
    getPublishedPage("front_note"),
  ]);

  return (
    <main id="content" className="front wrap">
      <h1 className="sr-only">{settings.publication_name}</h1>
      <div className="lead">
        {note ? (
          <section className="editors-note" aria-labelledby="note-heading">
            <h2 id="note-heading" className="kicker">From the editors</h2>
            <div className="excerpt" dangerouslySetInnerHTML={{ __html: note.html }} />
          </section>
        ) : null}
        {lead ? (
          <article>
            <h2 className="headline">
              <Link href={`/articles/${lead.slug}`}>{lead.title}</Link>
            </h2>
            {lead.deck ? <p className="deck">{lead.deck}</p> : null}
            <p className="byline">
              {KIND_LABEL[lead.kind]} by {lead.byline}
            </p>
            {lead.abstract ? (
              <div className="excerpt">
                <p>{lead.abstract}</p>
              </div>
            ) : null}
            <p className="more">
              <Link href={`/articles/${lead.slug}`}>Continue reading</Link>
            </p>
          </article>
        ) : (
          <section aria-labelledby="empty-heading">
            <h2 id="empty-heading" className="headline">Nothing published yet</h2>
            <div className="excerpt">
              <p>
                The Review hasn’t published its first piece. Pieces appear here after two editors have read them and
                an administrator has approved them.
              </p>
            </div>
            <p className="more">
              <Link href="/submissions">How to submit a piece</Link>
            </p>
          </section>
        )}
      </div>

      <aside className="rail" aria-label="Meetings and submissions">
        <section className="box" aria-labelledby="meeting-heading">
          <h2 id="meeting-heading">Next meeting</h2>
          {meeting && meeting.startsAt ? (
            <>
              <dl className="facts">
                <dt>When</dt>
                <dd>{formatMeetingTime(meeting.startsAt, meeting.timezone)}</dd>
                {meeting.location ? (
                  <>
                    <dt>Where</dt>
                    <dd>{meeting.location}</dd>
                  </>
                ) : null}
              </dl>
              {meeting.motion ? <p className="resolved">{meeting.motion}</p> : null}
              <p>
                See <Link href="/meetings">how meetings run</Link>.
              </p>
            </>
          ) : (
            <p>
              No meeting has been announced yet. See <Link href="/meetings">how meetings run</Link>.
            </p>
          )}
        </section>
        <section className="box" aria-labelledby="submit-heading">
          <h2 id="submit-heading">Submissions</h2>
          <p>
            {settings.submissions_open
              ? "The Review is reading essays, policy proposals, notes, and Forum replies by PCC students."
              : "The Review is not reading new submissions right now."}{" "}
            Read the <Link href="/submissions">guidelines</Link>.
          </p>
        </section>
      </aside>
    </main>
  );
}
