import { beforeAll, describe, expect, it } from "@jest/globals";

/**
 * Black-box checks of the running system: Next.js (APP_URL) in front of legacy PHP (LEGACY_URL).
 * Requires both apps to be running — see README.md.
 */
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const LEGACY_URL = process.env.LEGACY_URL ?? "http://localhost:8000";

async function get(path: string) {
  const response = await fetch(`${APP_URL}${path}`, { redirect: "manual" });
  // React separates adjacent text nodes with `<!-- -->`; strip them so assertions read naturally.
  const html = (await response.text()).replaceAll("<!-- -->", "");
  return { response, html };
}

const LEGACY_BANNER = "Served by the <strong>legacy PHP</strong> application";

beforeAll(async () => {
  const health = await fetch(`${LEGACY_URL}/api/health`).catch(() => null);
  if (!health?.ok) {
    throw new Error(`Legacy PHP is not running at ${LEGACY_URL}. Start it before running e2e tests.`);
  }
});

describe("articles list (Next.js)", () => {
  it("lists every published article with normalised data", async () => {
    const { response, html } = await get("/articles");

    expect(response.status).toBe(200);
    expect(html).not.toContain(LEGACY_BANNER);
    for (const title of [
      "Hello, Next.js: Why We Are Migrating",
      "Five TypeScript Tips for Former C# Developers",
      "Legacy PHP Patterns We Are Leaving Behind",
      "Migrating Page by Page Without Downtime",
      "Caching Strategies for Content Sites",
    ]) {
      expect(html).toContain(title.replace(/'/g, "&#x27;"));
    }
    expect(html).toContain("By John Smith"); // trimmed author
    expect(html).toContain("15 April 2024"); // UK date normalised
    expect(html).toContain("#csharp"); // array tags
  });
});

describe("migrated article (Next.js)", () => {
  it("renders natively with content-derived metadata", async () => {
    const { response, html } = await get("/articles/typescript-tips");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-served-by")).toBe("next-app");
    expect(html).not.toContain(LEGACY_BANNER);
    expect(html).toContain("<title>Five TypeScript Tips for Former C# Developers | Articles</title>");
    expect(html).toMatch(
      /<meta name="description" content="If you know C#, TypeScript will feel familiar\."/,
    );
    expect(html).toContain('<link rel="canonical" href="http://localhost:3000/articles/typescript-tips"/>');
    expect(html).toContain('<meta property="og:type" content="article"/>');
  });

  it("ignores query parameters it does not use", async () => {
    const { response, html } = await get("/articles/hello-nextjs?utm_source=newsletter");

    expect(response.status).toBe(200);
    expect(html).toContain("Hello, Next.js: Why We Are Migrating");
    expect(html).not.toContain(LEGACY_BANNER);
  });
});

describe("non-migrated article (transparent fallback to legacy)", () => {
  it("serves the legacy page under the same URL, preserving the query string", async () => {
    const { response, html } = await get("/articles/php-legacy-patterns?utm_source=newsletter&ref=e2e");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-served-by")).toBe("legacy-php");
    expect(response.headers.get("location")).toBeNull(); // a rewrite, not a redirect
    expect(html).toContain(LEGACY_BANNER);
    expect(html).toContain("<h1>Legacy PHP Patterns We Are Leaving Behind</h1>");
    expect(html).toContain(
      "Query parameters received by PHP: <code>?utm_source=newsletter&amp;ref=e2e</code>",
    );
  });

  it("passes legacy 404s through for unknown slugs", async () => {
    const { response, html } = await get("/articles/no-such-article");

    expect(response.status).toBe(404);
    expect(html).toContain("Article not found");
  });
});

describe("rest of the legacy site (fallback rewrite)", () => {
  it.each([
    ["/", "<h1>Legacy Site</h1>"],
    ["/about.php", "<h1>About</h1>"],
    ["/article.php?id=5", "<h1>Caching Strategies for Content Sites</h1>"],
  ])("serves %s from legacy", async (path, heading) => {
    const { response, html } = await get(path);

    expect(response.status).toBe(200);
    expect(html).toContain(LEGACY_BANNER);
    expect(html).toContain(heading);
  });
});

describe("no duplicated content", () => {
  it("only lets the canonical slug URL render a migrated article", async () => {
    // Legacy resolves numeric ids too; Next.js must not render a second copy at /articles/1.
    const { html } = await get("/articles/1");

    expect(html).toContain(LEGACY_BANNER);
  });
});
