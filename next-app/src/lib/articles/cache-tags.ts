/**
 * Cache tags for article data, shared by the repository (which tags cache entries) and the
 * revalidation webhook (which invalidates them), so the two can never drift apart.
 */

/** Every cached article entry: the list and every single article. */
export const ARTICLES_TAG = "articles";

/** The cached article list only. */
export const ARTICLE_LIST_TAG = "articles:list";

/** One cached article. */
export function articleTag(slug: string): string {
  return `article:${slug}`;
}
