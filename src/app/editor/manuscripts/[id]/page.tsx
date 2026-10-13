import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/manuscript-editor";
import { EditorNav } from "@/components/editor-nav";
import { AccessDenied, Flash, FormNav, Page, STATUS_LABEL, flashFrom, formatDateTime, type SearchParams } from "@/components/ui";
import { diffLines } from "@/server/diff";
import { AppError } from "@/server/errors";
import { renderMarkdown } from "@/server/render/markdown";
import { listIssuesAdmin } from "@/server/services/cms";
import { getForEditor } from "@/server/services/manuscripts";
import { listEditors } from "@/server/services/members";
import { KIND_LABEL } from "@/server/services/public-content";
import { currentActor } from "@/server/session";

export const metadata: Metadata = { title: "Manuscript" };

const REC = { accept: "Accept", changes: "Ask for changes", decline: "Decline" } as const;
const DEC = { accept: "Accepted", request_changes: "Changes requested", decline: "Declined", reopen: "Reopened" } as const;

const slugify = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/-$/, "");

type Props = { params: Promise<{ id: string }>; searchParams: SearchParams };

export default async function EditorManuscript({ params, searchParams }: Props) {
  const { id } = await params;
  const { notice, error, one } = await flashFrom(searchParams);
  const actor = (await currentActor())!;
  let d;
  try {
    d = await getForEditor(actor, id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    if (e instanceof AppError && e.status === 403) return <AccessDenied reason={e.code === "self_review" ? "forbidden" : "forbidden"} />;
    throw e;
  }
  const m = d.manuscript;
  const isAdmin = actor.role === "admin";
  const back = `/editor/manuscripts/${id}`;
  const mine = d.assignments.find((a) => a.active && a.editorId === actor.userId);
  const current = d.revisions.find((r) => r.id === m.currentRevisionId) ?? d.revisions.at(-1);
  const shown = d.revisions.find((r) => r.id === one("rev")) ?? current;
  const latestSeq = d.revisions.length ? Math.max(...d.revisions.map((r) => r.seq)) : 0;
  const authorSubs = d.revisions.filter((r) => r.source !== "editor_edit");
  const compareFrom = d.revisions.find((r) => r.id === one("from")) ?? (authorSubs.length > 1 ? authorSubs.at(-2) : undefined);
  const compareTo = d.revisions.find((r) => r.id === one("to")) ?? d.revisions.at(-1);
  const diff = compareFrom && compareTo && compareFrom.id !== compareTo.id ? diffLines(compareFrom.bodyMd, compareTo.bodyMd) : null;
  const liveVersion = d.publication?.versions.find((v) => v.id === d.publication?.currentVersionId);
  const liveRevision = liveVersion ? d.revisions.find((r) => r.id === liveVersion.revisionId) : undefined;
  const openChecks = d.checks.filter((c) => !c.resolved).length;
  const [editors, issueList] = isAdmin ? await Promise.all([listEditors(), listIssuesAdmin()]) : [[], []];
  const canRecommend = Boolean(mine) && (m.status === "in_review" || m.status === "resubmitted");
  const myRec = d.currentRecs.find((r) => r.editorId === actor.userId);

  return (
    <Page title={m.title || "Untitled"} wide>
      <EditorNav current="/editor" />
      <Flash notice={notice} error={error} />
      <dl className="facts-inline">
        <dt>Status</dt>
        <dd>
          <span className="status">{STATUS_LABEL[m.status]}</span>
        </dd>
        <dt>Kind</dt>
        <dd>{KIND_LABEL[m.kind]}</dd>
        <dt>Author</dt>
        <dd>{d.author ? `${d.author.displayName ?? d.author.name} (${d.author.email})` : <span className="status-warn">{m.attributionNote}</span>}</dd>
        <dt>Under review</dt>
        <dd>Version {current?.seq ?? "none"}{m.submittedAt ? `, submitted ${formatDateTime(m.submittedAt)}` : ""}</dd>
        <dt>Readers see</dt>
        <dd>
          {d.publication?.state === "live" && liveRevision ? (
            <>
              Version {liveRevision.seq} at <Link href={`/articles/${d.publication.slug}`}>/articles/{d.publication.slug}</Link>
            </>
          ) : d.publication ? (
            "Nothing (unpublished)"
          ) : (
            "Nothing (not published)"
          )}
        </dd>
      </dl>

      <div className="two-col">
        <div>
          <h2>
            Text of version {shown?.seq} {shown?.source === "editor_edit" ? "(editors’ edit)" : ""}
          </h2>
          {shown ? (
            <div className="preview-frame">
              <div className="body" dangerouslySetInnerHTML={{ __html: renderMarkdown(shown.bodyMd) }} />
            </div>
          ) : (
            <p className="empty">No version yet.</p>
          )}

          <h2>Versions</h2>
          <ul className="thread">
            {d.revisions.map((r) => (
              <li key={r.id}>
                <Link href={`${back}?rev=${r.id}`}>Version {r.seq}</Link>: {r.source === "editor_edit" ? "editors’ edit" : r.source === "migration" ? "imported" : "author submission"},{" "}
                {formatDateTime(r.createdAt)}
                {r.note ? <span className="hint"> {r.note}</span> : null}
                {r.id === m.currentRevisionId ? <span className="status"> under review</span> : null}
              </li>
            ))}
          </ul>
          {d.revisions.length > 1 ? (
            <form className="actions" method="get" action={back}>
              <label htmlFor="from" className="label-text">Compare</label>
              <select id="from" name="from" defaultValue={compareFrom?.id} className="w-narrow">
                {d.revisions.map((r) => (
                  <option key={r.id} value={r.id}>Version {r.seq}</option>
                ))}
              </select>
              <label htmlFor="to" className="label-text">with</label>
              <select id="to" name="to" defaultValue={compareTo?.id} className="w-narrow">
                {d.revisions.map((r) => (
                  <option key={r.id} value={r.id}>Version {r.seq}</option>
                ))}
              </select>
              <button className="button" type="submit">Show changes</button>
            </form>
          ) : null}
          {diff ? (
            <section aria-label="Changes between versions">
              <p className="hint">
                Changes from version {compareFrom?.seq} to version {compareTo?.seq}. Added lines are marked “added”, removed lines “removed”.
              </p>
              <div className="diff">
                {diff.map((l, i) =>
                  l.kind === "same" ? (
                    <div key={i}>{l.text || " "}</div>
                  ) : l.kind === "add" ? (
                    <div key={i}>
                      <ins><span className="sr-only">added: </span>{l.text || " "}</ins>
                    </div>
                  ) : (
                    <div key={i}>
                      <del><span className="sr-only">removed: </span>{l.text || " "}</del>
                    </div>
                  ),
                )}
              </div>
            </section>
          ) : null}

          {d.attachments.length ? (
            <>
              <h2>Files from the author</h2>
              <ul className="thread">
                {d.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={`/api/attachments/${a.id}`}>{a.filename}</a> <span className="save-state">({Math.ceil(a.sizeBytes / 1024)} KB)</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {["in_review", "resubmitted", "accepted", "published"].includes(m.status) && (mine || isAdmin) && current ? (
            <>
              <h2>Edit the text</h2>
              <p className="hint">Saves a new editors’ version. The version under review and anything already published stay as they are.</p>
              <form className="form" method="post" action={`/api/editor/manuscripts/${id}/edit`}>
                <FormNav back={back} next={back} />
                <input type="hidden" name="baseRevisionId" value={shown?.id ?? current.id} />
                <input type="hidden" name="expectedLatestSeq" value={latestSeq} />
                <div className="field">
                  <label htmlFor="e-title">Title</label>
                  <input id="e-title" name="title" type="text" defaultValue={(shown ?? current).title} maxLength={300} />
                </div>
                <div className="field">
                  <label htmlFor="e-deck">Subtitle</label>
                  <input id="e-deck" name="deck" type="text" defaultValue={(shown ?? current).deck} maxLength={500} />
                </div>
                <div className="field">
                  <label htmlFor="e-abstract">Abstract</label>
                  <textarea id="e-abstract" name="abstract" defaultValue={(shown ?? current).abstract} maxLength={3000} />
                </div>
                <div className="field">
                  <label htmlFor="e-body">Text</label>
                  <textarea id="e-body" name="bodyMd" className="manuscript" defaultValue={(shown ?? current).bodyMd} />
                </div>
                <div className="field">
                  <label htmlFor="e-bio">Author bio</label>
                  <textarea id="e-bio" name="authorBio" defaultValue={(shown ?? current).authorBio} maxLength={1200} />
                </div>
                <div className="field">
                  <label htmlFor="e-note">What you changed</label>
                  <input id="e-note" name="note" type="text" maxLength={500} required />
                </div>
                <button className="button" type="submit">Save editors’ version</button>
              </form>
            </>
          ) : null}
        </div>

        <aside>
          <section className="panel" aria-labelledby="reviewers">
            <h2 id="reviewers">Reviewers</h2>
            <ul className="thread">
              {d.assignments.filter((a) => a.active).map((a) => (
                <li key={a.id}>
                  {a.name}
                  {a.editorId === actor.userId || isAdmin ? (
                    <form className="inline-form" method="post" action={`/api/editor/assignments/${a.id}/release`}>
                      <FormNav back={back} next={back} />{" "}
                      <button className="button" type="submit">Release</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {d.assignments.every((a) => !a.active) ? <p className="empty">No reviewer yet.</p> : null}
            {!mine && ["submitted", "in_review", "resubmitted"].includes(m.status) ? (
              <form method="post" action={`/api/editor/manuscripts/${id}/claim`}>
                <FormNav back={back} next={back} />
                <button className="button button-primary" type="submit">Review this piece</button>
              </form>
            ) : null}
            {isAdmin && ["submitted", "in_review", "resubmitted"].includes(m.status) ? (
              <form className="actions" method="post" action={`/api/admin/manuscripts/${id}/assign`}>
                <FormNav back={back} next={back} />
                <label htmlFor="editorId" className="sr-only">Assign a reviewer</label>
                <select id="editorId" name="editorId" required className="w-medium">
                  <option value="">Assign a reviewer…</option>
                  {editors.filter((e) => e.id !== m.authorId).map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <button className="button" type="submit">Assign</button>
              </form>
            ) : null}
          </section>

          <section className="panel" aria-labelledby="recs">
            <h2 id="recs">Recommendations on version {current?.seq}</h2>
            <p className="hint">{new Set(d.currentRecs.map((r) => r.editorId)).size} of the 2 needed before acceptance.</p>
            <ul className="thread">
              {d.currentRecs.map((r) => (
                <li key={r.id}>
                  <p className="byline">
                    {r.name}: {REC[r.recommendation]} · {formatDateTime(r.createdAt)}
                  </p>
                  {r.rationale ? <p className="pre-wrap">{r.rationale}</p> : null}
                </li>
              ))}
            </ul>
            {canRecommend && !myRec && current ? (
              <form className="form" method="post" action={`/api/editor/manuscripts/${id}/recommend`}>
                <FormNav back={back} next={back} />
                <input type="hidden" name="revisionId" value={current.id} />
                <fieldset>
                  <legend>Your recommendation</legend>
                  {(Object.keys(REC) as (keyof typeof REC)[]).map((k) => (
                    <div className="checkbox" key={k}>
                      <input type="radio" id={`rec-${k}`} name="recommendation" value={k} required />
                      <label htmlFor={`rec-${k}`}>{REC[k]}</label>
                    </div>
                  ))}
                </fieldset>
                <div className="field">
                  <label htmlFor="rationale">Reasons (editors only)</label>
                  <textarea id="rationale" name="rationale" maxLength={8000} />
                </div>
                <button className="button button-primary" type="submit">Record recommendation</button>
              </form>
            ) : null}
          </section>

          <section className="panel" aria-labelledby="fb">
            <h2 id="fb">Comments to the author</h2>
            <p className="hint">The author sees these.</p>
            <ul className="thread">
              {d.feedback.map((f) => (
                <li key={f.id}>
                  <p className="byline">{f.name ?? "Editor"} · {formatDateTime(f.createdAt)}</p>
                  <p className="pre-wrap">{f.body}</p>
                </li>
              ))}
            </ul>
            {mine || isAdmin ? (
              <form className="form" method="post" action={`/api/editor/manuscripts/${id}/feedback`}>
                <FormNav back={back} next={back} />
                <label htmlFor="fb-body" className="sr-only">Comment to the author</label>
                <textarea id="fb-body" name="body" required maxLength={8000} />
                <button className="button" type="submit">Send to the author</button>
              </form>
            ) : null}
          </section>

          <section className="panel" aria-labelledby="notes">
            <h2 id="notes">Internal notes</h2>
            <p className="hint">Editors and administrators only. Never shown to the author or included in email.</p>
            <ul className="thread">
              {d.notes.map((n) => (
                <li key={n.id}>
                  <p className="byline">{n.name ?? "Editor"} · {formatDateTime(n.createdAt)}</p>
                  <p className="pre-wrap">{n.body}</p>
                </li>
              ))}
            </ul>
            <form className="form" method="post" action={`/api/editor/manuscripts/${id}/notes`}>
              <FormNav back={back} next={back} />
              <label htmlFor="note-body" className="sr-only">Internal note</label>
              <textarea id="note-body" name="body" required maxLength={8000} />
              <button className="button" type="submit">Add internal note</button>
            </form>
          </section>

          {d.decisions.length ? (
            <section className="panel" aria-labelledby="decs">
              <h2 id="decs">Decisions</h2>
              <ul className="thread">
                {d.decisions.map((x) => (
                  <li key={x.id}>
                    <p className="byline">{DEC[x.decision]} by {x.name ?? "an administrator"} · {formatDateTime(x.createdAt)}</p>
                    {x.authorNote ? <p className="pre-wrap">{x.authorNote}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {isAdmin ? (
            <>
              <section className="panel" aria-labelledby="decide">
                <h2 id="decide">Decision</h2>
                <form className="form" method="post" action={`/api/admin/manuscripts/${id}/decision`}>
                  <FormNav back={back} next={back} />
                  <input type="hidden" name="expectedVersion" value={m.version} />
                  <div className="field">
                    <label htmlFor="authorNote">Note to the author</label>
                    <textarea id="authorNote" name="authorNote" maxLength={8000} />
                  </div>
                  <div className="actions">
                    {["in_review", "resubmitted"].includes(m.status) ? (
                      <button className="button button-primary" type="submit" name="decision" value="accept">Accept</button>
                    ) : null}
                    {["submitted", "in_review", "resubmitted"].includes(m.status) ? (
                      <button className="button" type="submit" name="decision" value="request_changes">Request changes</button>
                    ) : null}
                    {["submitted", "in_review", "resubmitted", "changes_requested", "accepted"].includes(m.status) ? (
                      <button className="button button-danger" type="submit" name="decision" value="decline">Decline</button>
                    ) : null}
                    {m.status === "declined" ? (
                      <button className="button" type="submit" name="decision" value="reopen">Reopen for review</button>
                    ) : null}
                  </div>
                </form>
              </section>

              <section className="panel" aria-labelledby="checks">
                <h2 id="checks">Publication checks</h2>
                {d.checks.length === 0 ? <p className="empty">No checks.</p> : null}
                <ul className="thread">
                  {d.checks.map((c) => (
                    <li key={c.id}>
                      <form method="post" action={`/api/admin/checks/${c.id}`} className="actions tight">
                        <FormNav back={back} next={back} />
                        <input type="hidden" name="resolved" value={c.resolved ? "false" : "true"} />
                        <span>{c.resolved ? "Done: " : "Open: "}{c.label}</span>
                        <button className="button" type="submit">{c.resolved ? "Reopen" : "Mark done"}</button>
                      </form>
                    </li>
                  ))}
                </ul>
                <form className="actions" method="post" action={`/api/admin/manuscripts/${id}/checks`}>
                  <FormNav back={back} next={back} />
                  <label htmlFor="check-label" className="sr-only">New check</label>
                  <input id="check-label" name="label" type="text" placeholder="e.g. Citations verified" maxLength={300} className="w-medium" required />
                  <button className="button" type="submit">Add check</button>
                </form>
              </section>

              {m.status === "accepted" || m.status === "published" ? (
                <section className="panel" aria-labelledby="publish">
                  <h2 id="publish">{m.status === "published" ? "Publish a different version" : "Publish"}</h2>
                  {openChecks ? <p className="status-warn">{openChecks} publication check(s) still open.</p> : null}
                  <form className="form" method="post" action={`/api/admin/manuscripts/${id}/publish`}>
                    <FormNav back={back} next={back} />
                    <div className="field">
                      <label htmlFor="revisionId">Version to publish</label>
                      <select id="revisionId" name="revisionId" defaultValue={d.revisions.at(-1)?.id}>
                        {d.revisions.map((r) => (
                          <option key={r.id} value={r.id}>
                            Version {r.seq} ({r.source === "editor_edit" ? "editors’ edit" : r.source === "migration" ? "imported" : "author"})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="slug">Web address</label>
                      <input id="slug" name="slug" type="text" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={d.publication?.slug ?? slugify(m.title)} aria-describedby="slug-hint" />
                      <p className="hint" id="slug-hint">/articles/your-words-here. Lowercase letters, numbers and hyphens.</p>
                    </div>
                    <div className="field">
                      <label htmlFor="byline">Public byline</label>
                      <input id="byline" name="byline" type="text" required maxLength={200} defaultValue={liveVersion?.byline ?? d.author?.displayName ?? ""} />
                    </div>
                    <div className="field">
                      <label htmlFor="issueId">Issue (optional)</label>
                      <select id="issueId" name="issueId" defaultValue={d.publication?.issueId ?? ""}>
                        <option value="">Not in a numbered issue</option>
                        {issueList.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.volumeLabel}, Number {i.number} ({i.termLabel}){i.visible ? "" : ", hidden"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="issueOrder">Order in the issue</label>
                      <input id="issueOrder" name="issueOrder" type="number" min={0} defaultValue={d.publication?.issueOrder ?? 0} className="w-narrow" />
                    </div>
                    <p>
                      <Link href={`${back}?rev=${d.revisions.at(-1)?.id}`}>Read the chosen version above</Link> before publishing.
                    </p>
                    <button className="button button-primary" type="submit" disabled={openChecks > 0}>Publish</button>
                  </form>
                </section>
              ) : null}

              {d.publication ? (
                <section className="panel" aria-labelledby="versions">
                  <h2 id="versions">Published versions</h2>
                  <ul className="thread">
                    {d.publication.versions.map((v) => {
                      const r = d.revisions.find((x) => x.id === v.revisionId);
                      const live = v.id === d.publication?.currentVersionId && d.publication.state === "live";
                      return (
                        <li key={v.id}>
                          Version {r?.seq} published {formatDateTime(v.publishedAt)} {live ? <span className="status">live</span> : null}
                          {!live ? (
                            <form className="inline-form" method="post" action={`/api/admin/manuscripts/${id}/restore`}>
                              <FormNav back={back} next={back} />
                              <input type="hidden" name="versionId" value={v.id} />{" "}
                              <button className="button" type="submit">Make this live</button>
                            </form>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {d.publication.state === "live" ? (
                    <form method="post" action={`/api/admin/manuscripts/${id}/unpublish`}>
                      <FormNav back={back} next={back} />
                      <ConfirmButton label="Unpublish" message="Take this article off every public page? Its history is kept and it can be published again." />
                    </form>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}
        </aside>
      </div>
    </Page>
  );
}
