import { describe, expect, it } from "@jest/globals";
import type { Article } from "@/lib/articles/model";
import { findPublishedArticle, listPublishedArticles } from "@/lib/articles/queries";
import type { ArticleSource } from "@/lib/articles/source";

const article = (overrides: Partial<Article>): Article => ({
  id: "1",
  slug: "a",
  title: "A",
  summary: "",
  paragraphs: [],
  author: null,
  publishedAt: null,
  isPublished: true,
  isFeatured: false,
  tags: [],
  ...overrides,
});

/** In-memory source: the queries only depend on the interface, so no HTTP or legacy data is involved. */
const inMemorySource = (articles: Article[]): ArticleSource => ({
  listArticles: async () => articles,
  getArticle: async (slug) =>
    articles.find((candidate) => candidate.slug === slug || candidate.id === slug) ?? null,
});

describe("listPublishedArticles", () => {
  it("returns only published articles, newest first, undated last", async () => {
    const source = inMemorySource([
      article({ slug: "old", publishedAt: "2023-01-01T00:00:00.000Z" }),
      article({ slug: "undated", publishedAt: null }),
      article({ slug: "draft", publishedAt: "2025-01-01T00:00:00.000Z", isPublished: false }),
      article({ slug: "new", publishedAt: "2024-06-01T00:00:00.000Z" }),
    ]);

    const slugs = (await listPublishedArticles(source)).map((a) => a.slug);

    expect(slugs).toEqual(["new", "old", "undated"]);
  });

  it("propagates source failures so the page shows its error state", async () => {
    const source: ArticleSource = {
      listArticles: async () => {
        throw new Error("down");
      },
      getArticle: async () => null,
    };

    await expect(listPublishedArticles(source)).rejects.toThrow("down");
  });
});

describe("findPublishedArticle", () => {
  const source = inMemorySource([
    article({ id: "1", slug: "live" }),
    article({ id: "2", slug: "draft", isPublished: false }),
  ]);

  it("returns a published article by slug", async () => {
    await expect(findPublishedArticle(source, "live")).resolves.toMatchObject({ slug: "live" });
  });

  it("returns null for an unknown or unpublished slug", async () => {
    await expect(findPublishedArticle(source, "missing")).resolves.toBeNull();
    await expect(findPublishedArticle(source, "draft")).resolves.toBeNull();
  });

  it("returns null when the source resolves a non-canonical identifier (no duplicate pages)", async () => {
    await expect(findPublishedArticle(source, "1")).resolves.toBeNull();
  });
});
