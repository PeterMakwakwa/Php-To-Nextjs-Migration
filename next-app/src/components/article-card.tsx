import Link from "next/link";
import type { Article } from "@/lib/articles/model";
import { ArticleMeta } from "./article-meta";

type Props = {
  article: Article;
  /** Whether Next.js owns this article's page (otherwise legacy PHP serves it). */
  migrated: boolean;
};

export function ArticleCard({ article, migrated }: Props) {
  const href = `/articles/${article.slug}`;

  return (
    <article className="card">
      <div className="card-badges">
        {article.isFeatured && <span className="badge-featured">Featured</span>}
        {/* Demo aid: makes it obvious during review which system will serve the page. */}
        <span className="muted">{migrated ? "New experience" : "Classic page"}</span>
      </div>
      <h2 className="card-title">
        {migrated ? (
          <Link href={href} prefetch>
            {article.title}
          </Link>
        ) : (
          // Plain <a>: a full page load lets the proxy hand this URL to legacy PHP.
          // A client-side <Link> would try to fetch a Next.js payload that does not exist.
          <a href={href}>{article.title}</a>
        )}
      </h2>
      <p className="card-summary muted">{article.summary}</p>
      <ArticleMeta author={article.author} publishedAt={article.publishedAt} tags={article.tags} />
    </article>
  );
}
