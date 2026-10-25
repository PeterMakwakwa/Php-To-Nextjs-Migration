import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { legacyArticleSource } from "@/lib/legacy/article-source";
import { ARTICLE_LIST_TAG, ARTICLES_TAG, articleTag } from "./cache-tags";
import type { Article } from "./model";
import { findPublishedArticle, listPublishedArticles } from "./queries";
import type { ArticleSource } from "./source";

/**
 * Article repository — the only entry point pages use for article data.
 *
 * Results are cached with the `articles` profile (next.config.ts): reads are served from
 * cache, refreshed in the background, and the last good copy keeps being served if the
 * legacy system goes down. Failures are never cached, so a retry hits legacy again.
 * When legacy content changes, the revalidation webhook (app/api/revalidate) drops the tagged
 * entries at once instead of waiting for the next background refresh.
 */

/**
 * The one place that picks the `ArticleSource` implementation (the composition root). Moving to a CMS
 * means changing this line. It is a module constant rather than a parameter because `"use cache"`
 * functions only accept serializable arguments.
 */
const source: ArticleSource = legacyArticleSource;

/** All published articles, newest first. Records that fail validation are logged and skipped. */
export async function getArticles(): Promise<Article[]> {
  "use cache";
  cacheLife("articles");
  cacheTag(ARTICLES_TAG, ARTICLE_LIST_TAG);

  return listPublishedArticles(source);
}

/** A single published article, or `null` when the source has no (published) article with that slug. */
export async function getArticle(slug: string): Promise<Article | null> {
  "use cache";
  cacheLife("articles");
  cacheTag(ARTICLES_TAG, articleTag(slug));

  return findPublishedArticle(source, slug);
}
