import { NextRequest } from "next/server";
import { getRewrittenUrl, isRewrite, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "@jest/globals";
import { config, proxy } from "@/proxy";
import nextConfig from "../../next.config";

const request = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));

describe("proxy", () => {
  it("lets Next.js render migrated articles", () => {
    const response = proxy(request("/articles/hello-nextjs"));

    expect(isRewrite(response)).toBe(false);
    expect(response.headers.get("x-served-by")).toBe("next-app");
  });

  it("transparently rewrites non-migrated articles to legacy, preserving the query string", () => {
    const response = proxy(request("/articles/php-legacy-patterns?utm_source=newsletter&page=2"));

    expect(isRewrite(response)).toBe(true);
    expect(getRewrittenUrl(response)).toBe(
      "http://localhost:8000/articles/php-legacy-patterns?utm_source=newsletter&page=2",
    );
    expect(response.headers.get("x-served-by")).toBe("legacy-php");
  });

  it("forwards unknown slugs to legacy, which owns the 404", () => {
    expect(getRewrittenUrl(proxy(request("/articles/does-not-exist")))).toBe(
      "http://localhost:8000/articles/does-not-exist",
    );
  });

  it("matches slugs case-insensitively", () => {
    expect(isRewrite(proxy(request("/articles/Hello-NextJS")))).toBe(false);
  });

  it("does not crash on malformed URL escapes", () => {
    expect(isRewrite(proxy(request("/articles/%E0%A4%A")))).toBe(true);
  });
});

describe("proxy matcher", () => {
  it.each([
    ["/articles/hello-nextjs", true],
    ["/articles/php-legacy-patterns", true],
    ["/articles", false],
    ["/about.php", false],
    ["/_next/static/chunk.js", false],
  ])("%s → runs proxy: %s", (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(expected);
  });
});

describe("next.config fallback rewrite", () => {
  // Fallback rewrites depend on filesystem routing, so their runtime effect is covered by the e2e suite.
  it("forwards every unmatched path to the legacy origin", async () => {
    const rewrites = await nextConfig.rewrites!();

    expect(rewrites).toMatchObject({
      fallback: [{ source: "/:path*", destination: "http://localhost:8000/:path*" }],
    });
    // Nothing may run *before* the filesystem routes, or it could shadow migrated pages.
    expect(rewrites).toMatchObject({ beforeFiles: [], afterFiles: [] });
  });
});
