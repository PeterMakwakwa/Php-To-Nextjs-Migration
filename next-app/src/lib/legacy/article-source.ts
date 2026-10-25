import "server-only";
import type { Article } from "@/lib/articles/model";
import type { ArticleSource } from "@/lib/articles/source";
import { createLogger } from "@/lib/logging";
import { fetchRawArticle, fetchRawArticles, LegacyApiError } from "./client";
import { normalizeArticle } from "./normalize";
import { RawArticleSchema } from "./schemas";

const log = createLogger("legacy-articles");

/**
 * `ArticleSource` backed by the legacy PHP API: fetch (client.ts) → validate (schemas.ts) → map (normalize.ts).
 * This is the anti-corruption layer: the messy legacy shape never leaves `lib/legacy`.
 */
export const legacyArticleSource: ArticleSource = {
  async listArticles(): Promise<Article[]> {
    const records = await fetchRawArticles();
    const articles: Article[] = [];

    for (const record of records) {
      const parsed = RawArticleSchema.safeParse(record);
      if (!parsed.success) {
        // One bad record must not take the whole list down.
        log.warn("Skipping invalid legacy record", { issues: parsed.error.issues });
        continue;
      }
      articles.push(normalizeArticle(parsed.data));
    }

    return articles;
  },

  async getArticle(slug: string): Promise<Article | null> {
    const record = await fetchRawArticle(slug);
    if (record === null) {
      return null;
    }

    const parsed = RawArticleSchema.safeParse(record);
    if (!parsed.success) {
      throw new LegacyApiError(`Legacy article "${slug}" failed validation`, "bad-response", undefined, {
        cause: parsed.error,
      });
    }

    return normalizeArticle(parsed.data);
  },
};
