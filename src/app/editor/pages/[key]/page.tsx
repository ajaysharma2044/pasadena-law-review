import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ManuscriptBody } from "@/components/manuscript-editor";
import { EditorNav } from "@/components/editor-nav";
import { Flash, FormNav, Page, flashFrom, formatDateTime, type SearchParams } from "@/components/ui";
import { renderMarkdown } from "@/server/render/markdown";
import { PAGE_LABELS, pageVersions } from "@/server/services/cms";
import { PAGE_KEYS, type PageKey } from "@/server/services/public-content";
import { currentActor } from "@/server/session";

export const metadata: Metadata = { title: "Edit page" };

type Props = { params: Promise<{ key: string }>; searchParams: SearchParams };

export default async function EditPage({ params, searchParams }: Props) {
  const { key } = await params;
  if (!PAGE_KEYS.includes(key as PageKey)) notFound();
  const { notice, error } = await flashFrom(searchParams);
  const actor = (await currentActor())!;
  const versions = await pageVersions(key);
  const published = versions.find((v) => v.status === "published");
  const proposals = versions.filter((v) => v.status === "proposed");
  const back = `/editor/pages/${key}`;
  return (
    <Page title={PAGE_LABELS[key as PageKey]} wide>
      <EditorNav current="/editor/pages" />
      <Flash notice={notice} error={error} />
      <div className="two-col">
        <div>
          <h2>Propose a change</h2>
          <form className="form" method="post" action={`/api/editor/pages/${key}`}>
            <FormNav back={back} next={back} />
            <ManuscriptBody name="bodyMd" label="Page text" defaultValue={published?.bodyMd ?? ""} />
            <div className="field">
              <label htmlFor="note">What changed and why</label>
              <input id="note" name="note" type="text" maxLength={500} required />
            </div>
            <div className="actions">
              <button className="button" type="submit">Send to the administrators</button>
              {actor.role === "admin" ? (
                <button className="button button-primary" type="submit" formAction={`/api/admin/pages/direct/${key}`}>Publish now</button>
              ) : null}
            </div>
          </form>
        </div>
        <aside>
          <section className="panel" aria-labelledby="live">
            <h2 id="live">Public now</h2>
            {published ? (
              <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(published.bodyMd) }} />
            ) : (
              <p className="empty">This page has no published text.</p>
            )}
          </section>
          <section className="panel" aria-labelledby="waiting">
            <h2 id="waiting">Proposals waiting</h2>
            {proposals.length === 0 ? <p className="empty">None.</p> : null}
            {proposals.map((v) => (
              <div key={v.id} className="thread">
                <p className="byline">
                  {v.author ?? "An editor"} · {formatDateTime(v.createdAt)} · {v.note}
                </p>
                <div className="preview-frame prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(v.bodyMd) }} />
                {actor.role === "admin" ? (
                  <div className="actions">
                    <form method="post" action={`/api/admin/pages/${v.id}/publish`}>
                      <FormNav back={back} next={back} />
                      <button className="button button-primary" type="submit">Publish this version</button>
                    </form>
                    <form method="post" action={`/api/admin/pages/${v.id}/reject`}>
                      <FormNav back={back} next={back} />
                      <button className="button button-danger" type="submit">Decline</button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </section>
        </aside>
      </div>
    </Page>
  );
}
