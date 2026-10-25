import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ARTICLE_LIST_TAG, ARTICLES_TAG, articleTag } from "@/lib/articles/cache-tags";
import { createLogger } from "@/lib/logging";

const log = createLogger("revalidate");

/**
 * Revalidation webhook: the legacy system calls this after saving an article, so the change shows up
 * on the next page view instead of after the 60-second background refresh.
 *
 *   POST /api/revalidate
 *   Authorization: Bearer <REVALIDATE_SECRET>
 *   { "slug": "caching-strategies" }   → that article and the list
 *   {}                                 → every article (bulk edits, imports)
 *
 * The endpoint is disabled (404) unless REVALIDATE_SECRET is set. The secret is read here rather than in
 * `config/env.ts`, which is deliberately secret-free because `next.config.ts` and `proxy.ts` import it.
 */

const BodySchema = z.object({
  slug: z.string().trim().toLowerCase().min(1).max(200).optional(),
});

/**
 * `expire: 0` drops the cached copy outright, so the next visitor gets fresh content rather than one more
 * stale view while it refreshes in the background (the `"max"` behaviour). The trade-off: until someone
 * visits, there is no last good copy to fall back on if legacy goes down.
 */
const EXPIRE_NOW = { expire: 0 };

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!isAuthorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = BodySchema.safeParse(await readJson(request));
  if (!body.success) {
    return Response.json({ error: 'Expected a JSON body like { "slug": "..." } or {}' }, { status: 400 });
  }

  const { slug } = body.data;
  const tags = slug ? [ARTICLE_LIST_TAG, articleTag(slug)] : [ARTICLES_TAG];
  for (const tag of tags) {
    revalidateTag(tag, EXPIRE_NOW);
  }

  // Expiring the data alone is not enough for article pages prerendered at build: measured on a production
  // build, the first visit after the webhook still got the old page. Expiring the stored pages as well makes
  // that first visit fresh. The route pattern is required: the literal `/articles/{slug}` path did not help.
  // It re-renders every article page on its next visit, which is cheap because only this article's data expired.
  const path = slug ? "/articles/[slug]" : "/articles";
  revalidatePath(path, slug ? "page" : "layout");

  log.info("Expired cached articles", { tags, path });
  return Response.json({ revalidated: tags });
}

/** An empty body means "everything"; anything else must be valid JSON. */
async function readJson(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (text.trim() === "") {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Constant-time comparison, so the response time does not reveal how much of the secret matched. */
function isAuthorized(header: string | null, secret: string): boolean {
  const provided = Buffer.from(header?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
