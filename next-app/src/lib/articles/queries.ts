import type { Article } from "./model";
import type { ArticleSource } from "./source";

/**
 * Article use cases, written against `ArticleSource` only, so they work with any backend and are
 * unit-tested with an in-memory source. `repository.ts` adds caching and supplies the real source.
 */

/** Published articles, newest first. */
export async function listPublishedArticles(source: ArticleSource): Promise<Article[]> {
  const articles = await source.listArticles();
  return articles.filter((article) => article.isPublished).sort(byNewestFirst);
}

/** A published article by its canonical slug, or `null`. */
export async function findPublishedArticle(source: ArticleSource, slug: string): Promise<Article | null> {
  const article = await source.getArticle(slug);
  // A source may resolve other identifiers (legacy also accepts numeric ids); only the canonical slug
  // URL may render, to avoid duplicate pages.
  return article?.isPublished && article.slug === slug ? article : null;
}

function byNewestFirst(a: Article, b: Article): number {
  return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
}
