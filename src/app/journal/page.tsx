import type { Metadata } from "next";
import Link from "next/link";
import { KIND_LABEL, listVisibleIssues } from "@/server/services/public-content";

export const metadata: Metadata = { title: "The Journal" };

export default async function JournalPage() {
  const issues = await listVisibleIssues();
  return (
    <main id="content">
      <div className="page-head narrow">
        <h1>The Journal</h1>
        <p>
          The Journal publishes one volume each academic year, with a number each term. Short replies and meeting minutes
          appear in the <Link href="/forum">Forum</Link>.
        </p>
      </div>
      <div className="page narrow">
        <div className="prose">
          {issues.length === 0 ? (
            <p className="empty">No numbers have been published yet.</p>
          ) : (
            issues.map((issue) => (
              <section key={issue.id} aria-labelledby={`issue-${issue.id}`}>
                <h2 id={`issue-${issue.id}`}>
                  {issue.volumeLabel}, Number {issue.number} ({issue.termLabel})
                </h2>
                {issue.pieces.length === 0 ? (
                  <p className="meta">In preparation</p>
                ) : (
                  <ol className="toc">
                    {issue.pieces.map((p) => (
                      <li key={p.slug}>
                        <p className="kicker">{KIND_LABEL[p.kind]}</p>
                        <Link href={`/articles/${p.slug}`}>{p.title}</Link>
                        <p className="byline">By {p.byline}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
