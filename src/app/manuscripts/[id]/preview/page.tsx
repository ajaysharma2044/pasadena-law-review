import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/ui";
import { AppError } from "@/server/errors";
import { renderMarkdown } from "@/server/render/markdown";
import { getForAuthor } from "@/server/services/manuscripts";
import { KIND_LABEL } from "@/server/services/public-content";
import { getProfile } from "@/server/services/profile";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Preview", robots: { index: false } };

/** The author's working copy (or latest submission) set in the journal's article typography. */
export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await pageAccess(`/manuscripts/${id}/preview`);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  let data;
  try {
    data = await getForAuthor(access.actor, id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const m = data.manuscript;
  const profile = await getProfile(access.actor.userId);
  return (
    <main id="content">
      <p className="dev-banner" role="note">
        Preview only. This isn’t published. <Link href={`/manuscripts/${id}`}>Back to the manuscript</Link>
      </p>
      <article>
        <header className="article-head">
          <p className="kicker">{KIND_LABEL[m.kind]}</p>
          <h1>{m.title || "Untitled draft"}</h1>
          {m.deck ? <p className="deck">{m.deck}</p> : null}
          <p className="byline">By {profile?.displayName ?? access.actor.name}</p>
        </header>
        <div className="body" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.bodyMd) }} />
      </article>
    </main>
  );
}
