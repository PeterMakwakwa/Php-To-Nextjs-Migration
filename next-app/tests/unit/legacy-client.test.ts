import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fetchRawArticle, fetchRawArticles, LegacyApiError } from "@/lib/legacy/client";

const mockFetch = (impl: () => Promise<Response>) => jest.spyOn(globalThis, "fetch").mockImplementation(impl);

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {}); // failures are logged; keep test output clean
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("legacy client", () => {
  it("returns the raw article list", async () => {
    mockFetch(async () => Response.json([{ slug: "a" }]));
    await expect(fetchRawArticles()).resolves.toEqual([{ slug: "a" }]);
  });

  it("URL-encodes the slug", async () => {
    const fetchSpy = mockFetch(async () => Response.json({ slug: "a b" }));

    await fetchRawArticle("a b");

    expect(fetchSpy).toHaveBeenCalledWith("http://localhost:8000/api/articles/a%20b", expect.anything());
  });

  it("returns null for a 404", async () => {
    mockFetch(async () => Response.json({ error: "Article not found" }, { status: 404 }));
    await expect(fetchRawArticle("missing")).resolves.toBeNull();
  });

  it("throws 'unavailable' for a 5xx response", async () => {
    mockFetch(async () => Response.json({ error: "down" }, { status: 503 }));
    await expect(fetchRawArticles()).rejects.toMatchObject({ kind: "unavailable", status: 503 });
  });

  it("throws 'unavailable' when the server cannot be reached", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchRawArticles()).rejects.toBeInstanceOf(LegacyApiError);
  });

  it("throws 'timeout' when the request is aborted by the timeout signal", async () => {
    mockFetch(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    await expect(fetchRawArticles()).rejects.toMatchObject({ kind: "timeout" });
  });

  it("throws 'bad-response' for invalid JSON or an unexpected shape", async () => {
    mockFetch(async () => new Response("<html>oops</html>", { status: 200 }));
    await expect(fetchRawArticles()).rejects.toMatchObject({ kind: "bad-response" });

    mockFetch(async () => Response.json({ not: "an array" }));
    await expect(fetchRawArticles()).rejects.toMatchObject({ kind: "bad-response" });
  });
});
