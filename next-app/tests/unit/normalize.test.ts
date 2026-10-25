import { describe, expect, it } from "@jest/globals";
import legacyArticles from "../fixtures/legacy-articles.json";
import {
  deriveSummary,
  firstText,
  normalizeArticle,
  parseLegacyBoolean,
  parseLegacyDate,
  parseTags,
  splitParagraphs,
} from "@/lib/legacy/normalize";
import { RawArticleSchema } from "@/lib/legacy/schemas";

describe("parseLegacyDate", () => {
  it.each([
    ["2024-03-15", "2024-03-15T00:00:00.000Z"],
    ["15/04/2024", "2024-04-15T00:00:00.000Z"],
    ["June 20, 2024", "2024-06-20T00:00:00.000Z"],
    ["june 20 2024", "2024-06-20T00:00:00.000Z"],
    ["2024-07-01T09:30:00+02:00", "2024-07-01T07:30:00.000Z"],
    ["2024-07-01T09:30:00Z", "2024-07-01T09:30:00.000Z"],
    [1717200000, "2024-06-01T00:00:00.000Z"],
    ["1717200000", "2024-06-01T00:00:00.000Z"],
    [1717200000000, "2024-06-01T00:00:00.000Z"],
  ])("parses %j", (input, expected) => {
    expect(parseLegacyDate(input)).toBe(expected);
  });

  it.each([null, undefined, "", "not a date", "31/02/2024", "2024-13-01", "Smarch 1, 2024", "04/15/2024"])(
    "returns null for %j instead of guessing",
    (input) => {
      expect(parseLegacyDate(input)).toBeNull();
    },
  );
});

describe("parseLegacyBoolean", () => {
  it.each([
    [true, true],
    [1, true],
    ["1", true],
    ["yes", true],
    ["TRUE", true],
    [" on ", true],
    [false, false],
    [0, false],
    ["0", false],
    ["no", false],
    ["false", false],
    ["", false],
  ])("maps %j to %j", (input, expected) => {
    expect(parseLegacyBoolean(input)).toBe(expected);
  });

  it.each([null, undefined, "maybe"])("returns null for unknown value %j", (input) => {
    expect(parseLegacyBoolean(input)).toBeNull();
  });
});

describe("parseTags", () => {
  it("splits comma-separated strings, trimming blanks", () => {
    expect(parseTags("nextjs, react,typescript")).toEqual(["nextjs", "react", "typescript"]);
    expect(parseTags("php, legacy, ")).toEqual(["php", "legacy"]);
    expect(parseTags("migration,devops,,architecture")).toEqual(["migration", "devops", "architecture"]);
  });

  it("accepts arrays and normalises case and duplicates", () => {
    expect(parseTags(["TypeScript", " typescript ", "Tips"])).toEqual(["typescript", "tips"]);
  });

  it.each([null, undefined, "", " , "])("returns an empty list for %j", (input) => {
    expect(parseTags(input)).toEqual([]);
  });
});

describe("splitParagraphs", () => {
  it("splits on blank lines and tolerates Windows line endings", () => {
    expect(splitParagraphs("One.\r\n\r\nTwo\r\nlines.\n\n\nThree.")).toEqual([
      "One.",
      "Two lines.",
      "Three.",
    ]);
  });

  it("returns no paragraphs for an empty body", () => {
    expect(splitParagraphs(null)).toEqual([]);
    expect(splitParagraphs("   ")).toEqual([]);
  });
});

describe("firstText", () => {
  it("returns the first non-blank value, trimmed", () => {
    expect(firstText(null, "  ", "  John Smith ", "ignored")).toBe("John Smith");
    expect(firstText(undefined, "")).toBeNull();
  });
});

describe("deriveSummary", () => {
  it("uses a short first paragraph as-is", () => {
    expect(deriveSummary(["Short intro.", "More."])).toBe("Short intro.");
  });

  it("truncates long paragraphs on a word boundary", () => {
    const summary = deriveSummary(["word ".repeat(60)]);
    expect(summary.length).toBeLessThanOrEqual(161);
    expect(summary.endsWith("word…")).toBe(true);
  });
});

describe("normalizeArticle", () => {
  it("maps alternative field names", () => {
    const article = normalizeArticle(
      RawArticleSchema.parse({
        article_id: "2",
        slug: "typescript-tips",
        headline: "Headline",
        content: "Body text.",
        author_name: "Peter M.",
        date: "15/04/2024",
        published: "1",
        featured: "0",
        tag_list: "a,b",
      }),
    );

    expect(article).toEqual({
      id: "2",
      slug: "typescript-tips",
      title: "Headline",
      summary: "Body text.",
      paragraphs: ["Body text."],
      author: "Peter M.",
      publishedAt: "2024-04-15T00:00:00.000Z",
      isPublished: true,
      isFeatured: false,
      tags: ["a", "b"],
    });
  });

  it("applies safe defaults when values are missing", () => {
    const article = normalizeArticle(RawArticleSchema.parse({ slug: "Bare-Record" }));

    expect(article).toEqual({
      id: "Bare-Record",
      slug: "bare-record",
      title: "Untitled",
      summary: "",
      paragraphs: [],
      author: null,
      publishedAt: null,
      isPublished: true,
      isFeatured: false,
      tags: [],
    });
  });

  it("rejects records without a slug at the schema boundary", () => {
    expect(RawArticleSchema.safeParse({ id: 9, title: "No slug" }).success).toBe(false);
  });
});

describe("the real legacy dataset", () => {
  const articles = legacyArticles.map((record) => normalizeArticle(RawArticleSchema.parse(record)));

  it("validates and normalises every record", () => {
    expect(articles).toHaveLength(5);
  });

  it("produces a complete, consistent model for every record", () => {
    for (const article of articles) {
      expect(article.title).not.toBe("Untitled");
      expect(article.summary.length).toBeGreaterThan(0);
      expect(article.paragraphs.length).toBeGreaterThan(0);
      expect(article.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(article.isPublished).toBe(true);
      expect(article.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("matches the expected snapshot of normalised values", () => {
    expect(
      articles.map(({ slug, author, publishedAt, isFeatured, tags }) => ({
        slug,
        author,
        publishedAt,
        isFeatured,
        tags,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "author": "Jane Doe",
          "isFeatured": true,
          "publishedAt": "2024-03-15T00:00:00.000Z",
          "slug": "hello-nextjs",
          "tags": [
            "nextjs",
            "react",
            "typescript",
          ],
        },
        {
          "author": "Peter M.",
          "isFeatured": false,
          "publishedAt": "2024-04-15T00:00:00.000Z",
          "slug": "typescript-tips",
          "tags": [
            "typescript",
            "csharp",
            "tips",
          ],
        },
        {
          "author": null,
          "isFeatured": false,
          "publishedAt": "2024-06-01T00:00:00.000Z",
          "slug": "php-legacy-patterns",
          "tags": [
            "php",
            "legacy",
          ],
        },
        {
          "author": "John Smith",
          "isFeatured": true,
          "publishedAt": "2024-06-20T00:00:00.000Z",
          "slug": "migrating-without-downtime",
          "tags": [
            "migration",
            "devops",
            "architecture",
          ],
        },
        {
          "author": null,
          "isFeatured": false,
          "publishedAt": "2024-07-01T07:30:00.000Z",
          "slug": "caching-strategies",
          "tags": [],
        },
      ]
    `);
  });
});
