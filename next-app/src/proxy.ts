import { NextResponse, type NextRequest } from "next/server";
import { isMigrated, toLegacyUrl } from "@/config/migration";

/**
 * Migration router — runs before routing, like ASP.NET Core middleware or a YARP route.
 *
 *   /articles/{migrated-slug}   → continue to the Next.js page
 *   /articles/{anything-else}   → rewrite (not redirect) to the legacy PHP app,
 *                                 so the browser URL and query string stay exactly the same
 *
 * Every other unknown URL (/, /about.php, /article.php?id=3, …) reaches legacy through the
 * `fallback` rewrite in next.config.ts, which only applies when Next.js has no matching route.
 */
const ARTICLE_PATH = /^\/articles\/([^/]+)\/?$/;

/** Diagnostic header showing which system produced the response (handy with curl / DevTools). */
const SERVED_BY_HEADER = "x-served-by";

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const slug = ARTICLE_PATH.exec(pathname)?.[1];

  if (slug && isMigrated(safeDecode(slug))) {
    const response = NextResponse.next();
    response.headers.set(SERVED_BY_HEADER, "next-app");
    return response;
  }

  const response = NextResponse.rewrite(toLegacyUrl(pathname, search));
  response.headers.set(SERVED_BY_HEADER, "legacy-php");
  return response;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // malformed escapes can never match a migrated slug; legacy will 404
  }
}

export const config = {
  matcher: "/articles/:slug",
};
