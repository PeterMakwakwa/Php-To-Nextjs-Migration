import type { Article } from "./model";

/**
 * Where articles come from — the interface the rest of the app depends on (think: `IArticleSource`).
 *
 * An implementation owns everything specific to its backend (transport, raw shape, mapping) and
 * returns the normalized `Article`. Today that is the legacy PHP API (`lib/legacy/article-source.ts`);
 * a CMS or a cleaned-up API would be another implementation, with no change to pages or queries.
 *
 * Contract: resolve to `null` when an article does not exist; throw when the backend is slow,
 * unreachable or returns something unusable, so callers show the error state instead of a 404.
 */
export interface ArticleSource {
  /** Every article the backend has, published or not, in any order. */
  listArticles(): Promise<Article[]>;
  /** One article by slug (a backend may also resolve other identifiers), or `null` when it does not exist. */
  getArticle(slug: string): Promise<Article | null>;
}
