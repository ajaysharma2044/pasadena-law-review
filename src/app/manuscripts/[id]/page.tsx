import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton, ManuscriptBody } from "@/components/manuscript-editor";
import { AccessDenied, Flash, FormNav, Page, STATUS_LABEL, flashFrom, formatDateTime, type SearchParams } from "@/components/ui";
import { AppError } from "@/server/errors";
import { getForAuthor } from "@/server/services/manuscripts";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Your manuscript", robots: { index: false } };

const DECISION_TEXT = {
  accept: "Accepted",
  request_changes: "Changes requested",
  decline: "Declined",
  reopen: "Reopened for review",
} as const;

const NEXT_STEP: Record<string, string> = {
  submitted: "Two editors will read it. You’ll get an email when there’s a decision.",
  in_review: "Editors are reading it. You’ll get an email when there’s a decision.",
  resubmitted: "Your revision is with the editors.",
  accepted: "Accepted. The editors will finish the cite-check before it is published.",
  published: "Published.",
  declined: "The editors decided not to publish this piece.",
  withdrawn: "You withdrew this piece.",
};

type Props = { params: Promise<{ id: string }>; searchParams: SearchParams };

export default async function ManuscriptPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { notice, error } = await flashFrom(searchParams);
  const access = await pageAccess(`/manuscripts/${id}`);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  let data;
  try {
    data = await getForAuthor(access.actor, id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const m = data.manuscript;
  const editable = m.status === "draft" || m.status === "changes_requested";
  const back = `/manuscripts/${id}`;
  return (
    <Page title={m.title || "Untitled draft"}>
      <Flash notice={notice} error={error} />
      <p>
        <span className="status">{STATUS_LABEL[m.status]}</span>{" "}
        {m.submittedAt ? <span className="save-state">Last submitted {formatDateTime(m.submittedAt)}</span> : null}
      </p>
      {NEXT_STEP[m.status] ? <p>{NEXT_STEP[m.status]}</p> : null}
      {data.publication?.state === "live" ? (
        <p>
          Read it at <Link href={`/articles/${data.publication.slug}`}>/articles/{data.publication.slug}</Link>.
        </p>
      ) : null}

      {data.decisions.length || data.feedback.length ? (
        <section aria-labelledby="from-editors">
          <h2 id="from-editors">From the editors</h2>
          <ul className="thread">
            {data.decisions.map((d) => (
              <li key={d.id}>
                <p className="byline">
                  {DECISION_TEXT[d.decision]} · {formatDateTime(d.createdAt)}
                </p>
                {d.authorNote ? <p className="pre-wrap">{d.authorNote}</p> : null}
              </li>
            ))}
            {data.feedback.map((f) => (
              <li key={f.id}>
                <p className="byline">Comment · {formatDateTime(f.createdAt)}</p>
                <p className="pre-wrap">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editable ? (
        <>
          <h2>{m.status === "changes_requested" ? "Revise" : "Draft"}</h2>
          <form className="form" method="post" action={`/api/manuscripts/${id}`}>
            <FormNav back={back} next={back} />
            <input type="hidden" name="expectedVersion" value={m.version} />
            <div className="field">
              <label htmlFor="kind">Kind of piece</label>
              <select id="kind" name="kind" defaultValue={m.kind}>
                <option value="essay">Essay</option>
                <option value="proposal">Proposal</option>
                <option value="note">Note</option>
                <option value="forum">Forum piece</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" type="text" maxLength={300} defaultValue={m.title} />
            </div>
            <div className="field">
              <label htmlFor="deck">Subtitle (optional)</label>
              <input id="deck" name="deck" type="text" maxLength={500} defaultValue={m.deck} />
            </div>
            <div className="field">
              <label htmlFor="abstract">Abstract (optional, a few sentences)</label>
              <textarea id="abstract" name="abstract" maxLength={3000} defaultValue={m.abstract} />
            </div>
            <ManuscriptBody name="bodyMd" label="Text, with notes" defaultValue={m.bodyMd} />
            <div className="field">
              <label htmlFor="authorBio">Short bio for the byline (optional)</label>
              <textarea id="authorBio" name="authorBio" maxLength={1200} defaultValue={m.authorBio} />
            </div>
            <div className="field">
              <label htmlFor="disclosure">Disclosures (optional)</label>
              <textarea id="disclosure" name="disclosure" maxLength={2000} defaultValue={m.disclosure} aria-describedby="disclosure-hint" />
              <p className="hint" id="disclosure-hint">Anything a reader should know, such as a role in a case you write about or a tool you built that you mention.</p>
            </div>
            <div className="actions">
              <button className="button" type="submit">Save draft</button>
              <Link href={`/manuscripts/${id}/preview`}>Preview in the journal’s type</Link>
            </div>
          </form>

          <h2>Files for the editors</h2>
          <p>Optional: a Word (.docx) or PDF copy, up to 10 MB each. Readers never see these.</p>
          {data.attachments.length ? (
            <ul className="thread">
              {data.attachments.map((a) => (
                <li key={a.id}>
                  <a href={`/api/attachments/${a.id}`}>{a.filename}</a> <span className="save-state">({Math.ceil(a.sizeBytes / 1024)} KB)</span>{" "}
                  <form className="inline-form" method="post" action={`/api/attachments/${a.id}/delete`}>
                    <FormNav back={back} />
                    <button className="button" type="submit">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
          <form className="form" method="post" action={`/api/manuscripts/${id}/attachments`} encType="multipart/form-data">
            <div className="field">
              <label htmlFor="file">Choose a file</label>
              <input id="file" name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
            </div>
            <button className="button" type="submit">Upload</button>
          </form>

          <h2>{m.status === "changes_requested" ? "Resubmit" : "Submit"}</h2>
          <form className="form" method="post" action={`/api/manuscripts/${id}/submit`}>
            <FormNav back={back} next={back} />
            <input type="hidden" name="expectedVersion" value={m.version} />
            <p className="hint">Save your latest changes first; the submission uses the saved draft.</p>
            <div className="checkbox">
              <input type="checkbox" id="confirm_authorship" name="confirm_authorship" required />
              <label htmlFor="confirm_authorship">I wrote this piece, and it hasn’t been published elsewhere.</label>
            </div>
            <div className="checkbox">
              <input type="checkbox" id="confirm_sources" name="confirm_sources" required />
              <label htmlFor="confirm_sources">I’ve cited my sources, and the facts are accurate to the best of my knowledge.</label>
            </div>
            <div className="checkbox">
              <input type="checkbox" id="confirm_disclosure" name="confirm_disclosure" required />
              <label htmlFor="confirm_disclosure">I’ve disclosed anything a reader should know about my connection to the subject.</label>
            </div>
            <button className="button button-primary" type="submit">{m.status === "changes_requested" ? "Resubmit" : "Submit to the editors"}</button>
          </form>
        </>
      ) : (
        <>
          <h2>What you submitted</h2>
          <p>
            <Link href={`/manuscripts/${id}/preview`}>Read the submitted text</Link>
          </p>
        </>
      )}

      {data.revisions.length ? (
        <>
          <h2>History</h2>
          <ul className="thread">
            {data.revisions.map((r) => (
              <li key={r.id}>
                Version {r.seq}: {r.source === "editor_edit" ? "edited by the editors" : r.source === "migration" ? "imported" : "submitted by you"} ·{" "}
                {formatDateTime(r.createdAt)}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {["draft", "submitted", "in_review", "changes_requested", "resubmitted", "accepted"].includes(m.status) ? (
        <form className="actions" method="post" action={`/api/manuscripts/${id}/withdraw`}>
          <FormNav back={back} next="/dashboard" />
          <ConfirmButton label="Withdraw this piece" message="Withdraw this piece? The editors will stop work on it. This can’t be undone." />
        </form>
      ) : null}
    </Page>
  );
}
