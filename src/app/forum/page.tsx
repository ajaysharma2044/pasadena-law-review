import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, listLive } from "@/server/services/public-content";

export const metadata: Metadata = { title: "The Forum" };

export default async function ForumPage() {
  const pieces = await listLive({ kind: "forum" });
  return (
    <main id="content">
      <div className="page-head narrow">
        <h1>The Forum</h1>
        <p>Short replies to the journal and the minutes of each meeting.</p>
      </div>
      <div className="page narrow">
        <div className="prose">
          {pieces.length === 0 ? (
            <p className="empty">
              Nothing has appeared in the Forum yet. Replies go through the usual{" "}
              <Link href="/submissions">submission process</Link>.
            </p>
          ) : (
            <ol className="toc">
              {pieces.map((p) => (
                <li key={p.slug}>
                  <Link href={`/articles/${p.slug}`}>{p.title}</Link>
                  <p className="byline">
                    By {p.byline}, {formatDate(p.firstPublishedAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </main>
  );
}
