import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { legacyArticleSource } from "@/lib/legacy/article-source";

const mockFetch = (body: unknown, status = 200) =>
  jest.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(body, { status }));

afterEach(() => {
  jest.restoreAllMocks();
});

describe("legacyArticleSource", () => {
  it("validates and normalizes the list, skipping invalid records", async () => {
    mockFetch([{ slug: "a", headline: "Hello", is_published: 0 }, { title: "no slug" }]);
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const articles = await legacyArticleSource.listArticles();

    // Unpublished records are kept: filtering is a query rule, not a source concern.
    expect(articles).toEqual([expect.objectContaining({ slug: "a", title: "Hello", isPublished: false })]);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("returns a normalized article, or null for a 404", async () => {
    mockFetch({ slug: "a", title: "  Hello  " });
    await expect(legacyArticleSource.getArticle("a")).resolves.toMatchObject({ slug: "a", title: "Hello" });

    mockFetch({ error: "Article not found" }, 404);
    await expect(legacyArticleSource.getArticle("missing")).resolves.toBeNull();
  });

  it("throws 'bad-response' when a single record fails validation", async () => {
    mockFetch({ title: "no slug" });
    await expect(legacyArticleSource.getArticle("x")).rejects.toMatchObject({ kind: "bad-response" });
  });
});
