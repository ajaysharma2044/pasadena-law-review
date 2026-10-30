import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { visibleAwards } from "@/server/services/badges";
import { KIND_LABEL, formatDate, getLiveArticle } from "@/server/services/public-content";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getLiveArticle(slug);
  return article ? { title: article.title, description: article.deck || undefined } : { title: "Not found" };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getLiveArticle(slug);
  if (!article) notFound();
  const awards=await visibleAwards(article.authorId);
  const issueLine =
    article.issueVisible && article.volumeLabel ? `${article.volumeLabel}, Number ${article.issueNumber} (${article.issueTerm})` : null;
  return (
    <main id="content">
      <article>
        <header className="article-head">
          <p className="kicker">{KIND_LABEL[article.kind]}</p>
          <h1>{article.title}</h1>
          {article.deck ? <p className="deck">{article.deck}</p> : null}
          <p className="byline">
            By {article.byline}{awards.map(a=><span key={a.key} title="Editorial recognition"> · {a.title}</span>)}
            <br />
            {issueLine ? `${issueLine}. ` : ""}Published {formatDate(article.firstPublishedAt)}
            {article.versionPublishedAt.getTime() - article.firstPublishedAt.getTime() > 60_000
              ? `; revised ${formatDate(article.versionPublishedAt)}`
              : ""}
          </p>
        </header>
        <div className="body" dangerouslySetInnerHTML={{ __html: article.bodyHtml }} />
        {article.authorBio ? (
          <div className="after">
            <p>{article.authorBio}</p>
          </div>
        ) : null}
      </article>
    </main>
  );
}
