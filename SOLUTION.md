# Solution: Phased Migration from Legacy PHP to Next.js

> **Start here: the three decisions that matter most**
>
> 1. **Strangler fig with a rewrite, not a redirect:** Next.js sits in front, serves the slugs listed in `migration.json`, and transparently rewrites everything else to PHP, keeping URLs and query strings intact. Pages migrate or roll back without a restart. → [Deciding which slugs are migrated](#deciding-which-slugs-are-migrated), [Forwarding to legacy](#forwarding-to-legacy)
> 2. **Anti-corruption layer behind an interface:** the messy legacy shape never leaves `lib/legacy/`; everything else sees one normalized `Article` through the `ArticleSource` interface. → [Layering](#layering-in-net-terms), [Normalization rules](#normalization-rules)
> 3. **Cache-first resilience:** Server Components with cached, streamed data; a 5s timeout; the last good copy is served while PHP is down; a webhook makes edits show at once. → [Rendering, performance and caching](#rendering-performance-and-caching), [Slow or unavailable legacy](#slow-or-unavailable-legacy)
>
> **Verify it:** [README](./README.md) to run both apps; 105 unit, 9 end-to-end and 3 browser tests in [Quality and testing](#quality-and-testing); the named patterns in [Patterns and standards](#patterns-and-standards).

## Overview

```
                    ┌──────────────────────── Next.js :3000 ────────────────────────┐
Browser ──────────► │ proxy.ts                                                       │
                    │  /articles/{migrated}   → Next.js page (normalized model)      │
                    │  /articles/{other}      → rewrite ─────────────┐               │
                    │ next.config fallback                           │               │
                    │  any unmatched URL      → rewrite ─────────────┤               │
                    └────────────────────────────────────────────────┼───────────────┘
                              │ server-side fetch (JSON)             │ same URL + query string
                              ▼                                      ▼
                    ┌──────────────────────── Legacy PHP :8000 ─────────────────────┐
                    │ /api/articles, /api/articles/{slug}   (system of record)       │
                    │ /articles/{slug}, /, /about.php, /article.php?id=  (HTML)      │
                    └───────────────────────────────────────────────────────────────┘
```

This is the **strangler fig** pattern. Next.js sits in front of the site and owns a growing set of URLs.
Every other URL is passed through to PHP, which stays the only owner of the content.

Users always browse through `:3000`. They can't tell which system served a page, except for the yellow
"Served by the legacy PHP application" banner I added to the legacy pages so reviewers can see it.

---

## Task 1: Legacy PHP surface

**What:** plain PHP 8.4 on the built-in server. A front controller (`router.php`) routes requests to `Api` and
`Views`, which both read from a fixed array in `data/articles.php`. No framework, no database.

**Data inconsistencies (deliberate):** two names for the id, title, body and author fields; null, empty and
whitespace-padded values; five date formats (ISO date, UK `dd/mm/yyyy`, Unix timestamp, `June 20, 2024`,
ISO 8601 with a time-zone offset); booleans stored as `1`, `"1"`, `true`, `"yes"`, `"true"` and `0`;
tags as a comma-separated string with stray spaces and empty entries, as an array, or under a `tag_list` field.

**Stable identifier:** `slug`. It's the one field every record has, and all public URLs are built from it.
Numeric ids still resolve (`/api/articles/3`, `/article.php?id=3`), because legacy links exist in the wild.

**Testing support:** `?delay=ms` / `LEGACY_DELAY_MS` and `?fail=1` / `LEGACY_FAIL=1` simulate a slow or broken
system. `/api/health` is never affected, so the Docker health check stays reliable.

---

## Task 2: Next.js experience

### Layering (in .NET terms)

| Layer | File | .NET analogy |
| --- | --- | --- |
| Transport | `lib/legacy/client.ts` | Typed `HttpClient`: timeout, status codes, typed `LegacyApiError` |
| Boundary contract | `lib/legacy/schemas.ts` | Request DTO + validation (Zod ≈ FluentValidation) |
| Mapping | `lib/legacy/normalize.ts` | Explicit mapper (instead of AutoMapper), pure and unit-tested |
| Source implementation | `lib/legacy/article-source.ts` | `LegacyArticleSource : IArticleSource` (fetch → validate → map) |
| Source interface | `lib/articles/source.ts` | `IArticleSource` |
| Domain model | `lib/articles/model.ts` | The clean `Article` record |
| Use cases | `lib/articles/queries.ts` | Application service: published only, newest first, canonical slug |
| Data access | `lib/articles/repository.ts` | Composition root + output caching |
| Configuration | `config/env.ts` | `IOptions<T>` + `ValidateOnStart()` |
| Logging | `lib/logging/` | `ILogger<T>` + a console provider: scoped loggers, `LOG_LEVEL`, pretty or JSON output |

**The key decision: an anti-corruption layer behind an interface.** Everything that knows about PHP lives in
`lib/legacy/`, and its only export the app uses is `legacyArticleSource`, an implementation of the
`ArticleSource` interface that returns the normalized `Article`. Pages, components, metadata and the use cases
in `queries.ts` depend on the interface, never on the legacy shape.

```
pages ─► repository (cache) ─► queries ─► ArticleSource ◄── legacyArticleSource ─► client / schemas / normalize
                     └──────── picks the implementation ───────┘
```

When the source of record changes (a CMS, or a cleaned-up API), you write a new `ArticleSource` next to the
legacy one and change one line in `repository.ts`; nothing else changes. Because `queries.ts` takes the source
as a parameter, the use cases are unit-tested with an in-memory source, without HTTP.

*Why the repository picks the source with a module constant instead of constructor injection:* cached
(`"use cache"`) functions may only take serializable arguments, so an object with methods can't be passed in.
The uncached `queries.ts` functions take it as a parameter instead, which is where testability matters.

**Logging.** Server code never calls `console` directly; it asks for a scoped logger
(`createLogger("legacy-api")`, like `ILogger<T>`), so level, format and destination are decided in one place
(`lib/logging/index.ts`). Swapping in pino or OpenTelemetry later means one new `Logger` implementation.
- **What is logged:** every failed legacy call (URL, kind, status), skipped invalid records, migration-file
  problems, and each webhook refresh. Failed legacy calls matter most, because pages can keep serving a cached
  copy while legacy fails, which would otherwise leave no trace.
- **Format:** `pretty` in development; one JSON object per line in production (`level`, `scope`, `message`,
  fields, and errors with name, message, stack and cause), ready for a log collector. `LOG_LEVEL` and
  `LOG_FORMAT` override both.
- **No timestamps:** log collectors add them, and Cache Components forbids `new Date()` during prerendering,
  when some entries are written.
- **Browser errors** (`error.tsx`) still use `console.error`: the logger is server-side, and in production the
  browser only sees a redacted message whose `digest` links to the server log entry.

### Normalization rules

| Concern | Rule | Why |
| --- | --- | --- |
| Field variants | First non-blank of `title`/`headline`, `body`/`content`, `author`/`author_name`, … | Explicit, so the precedence order is easy to read |
| Dates | Each known format is parsed explicitly and stored as an ISO string in UTC. **Unknown formats return `null`** | Guessing is worse than showing no date. `Date.parse` behaves differently across runtimes |
| `dd/mm` vs `mm/dd` | Treated as **UK `dd/mm/yyyy`**. Impossible dates (`31/02`) are rejected | Documented assumption about the legacy locale |
| Calendar dates | Stored as UTC midnight and formatted in UTC | Prevents off-by-one-day bugs across time zones |
| Booleans | `1/"1"/true/"yes"/"true"/"on"` → true, opposites → false, anything else → unknown, then a default | Handles every form PHP produces |
| Missing `published` | Defaults to **published** | The legacy API only exposes live content |
| Tags | Split, trimmed, lower-cased, de-duplicated, blanks dropped | Consistent filtering and display |
| Summary | Legacy summary, or else the first paragraph cut to 160 characters on a word boundary | Every card and meta description has text |
| Body | Plain text split on blank lines into paragraphs (handles `\r\n`) | Legacy bodies are plain text, so no HTML sanitizing is needed |
| Invalid records | A record without a `slug` fails the schema. In the list it is **logged and skipped**, so one bad record never breaks the page | Partial results beat a full outage |
| Serialization | The model holds only plain values (ISO strings, no `Date`) | Safe to cache and to pass across server and client boundaries |

### Rendering, performance and caching

- **Server Components only.** Data is fetched on the server and the browser receives HTML. The only client
  JavaScript is Next's router and the error boundary.
- **Cache Components (`"use cache"` + `cacheLife("articles")`):** stale 60s / revalidate 60s / expire 1h.
  - The list page and the migrated articles are **pre-rendered at build time** (`generateStaticParams` returns
    the migrated slugs) and then refreshed in the background every minute (stale-while-revalidate, like ISR).
  - **Resilience:** if PHP goes down, users keep getting the last good copy for up to an hour.
    I tested this by killing PHP: migrated pages kept returning 200.
  - **Failures are never cached**, so a retry really does call legacy again.
- **On-demand refresh (webhook):** waiting up to a minute is fine for readers but confusing for an editor who
  just saved a change. So legacy can tell Next.js that content changed, and the change shows on the **next**
  page view. See [Content updates](#content-updates-revalidation-webhook) below.
- **Streaming:** data loads inside `<Suspense>` with skeleton placeholders. With PHP slowed to 2s, the page
  shell and skeleton arrived in about 0.08s and the content streamed in at about 2.2s.
- **Prefetching:** links to migrated articles use `<Link prefetch>`, so opening one is instant.

### Slow or unavailable legacy

| Situation | What the user sees |
| --- | --- |
| Slow but under 5s | Skeleton immediately, then the content streams in |
| Slower than `LEGACY_TIMEOUT_MS` (5s) | Request aborted (`AbortSignal.timeout`), then *"Articles are temporarily unavailable"* with a **Try again** button (`error.tsx` → `retry()`) |
| Down, with a cached copy | The cached page, with no visible problem |
| Down, nothing cached | The same friendly error state. Details stay in server logs (the production error message is redacted, and its `digest` links to the log entry) |
| Unknown or unpublished slug | `not-found.tsx` |

### Content updates (revalidation webhook)

```
editor saves in legacy ─► legacy-php/bin/notify-next.php [slug] ─► POST /api/revalidate ─► next view is fresh
```

- **`app/api/revalidate/route.ts`** accepts `POST` with `Authorization: Bearer <REVALIDATE_SECRET>` and an
  optional `{ "slug": "..." }`. With a slug it expires that article and the list; without one, every article.
  It is **disabled (404) unless `REVALIDATE_SECRET` is set**, compares the secret in constant time, and validates
  the body with Zod. The secret is read in the route, not in `config/env.ts`, which stays secret-free because
  `next.config.ts` and `proxy.ts` import it.
- **Cache tags** live in one module (`lib/articles/cache-tags.ts`) shared by the repository, which tags entries,
  and the webhook, which expires them: `articles` (everything), `articles:list`, `article:{slug}`.
- **`legacy-php/bin/notify-next.php`** is the legacy side: what a real CMS would call from its "save" hook. It
  uses PHP's built-in HTTP stream wrapper, so it needs no `curl` extension.

Two decisions, both measured on a production build rather than assumed:

| Decision | Why |
| --- | --- |
| `revalidateTag(tag, { expire: 0 })` instead of the recommended `"max"` | `"max"` serves one more stale view while refreshing in the background, which is exactly what confuses an editor. `{ expire: 0 }` makes the next view fresh |
| Also `revalidatePath("/articles/[slug]", "page")` (or `"/articles"` with `"layout"` for everything) | With tags alone, the list page was fresh at once but a **prerendered** article page still served one old copy first. Expiring the stored pages fixed it. The literal path `/articles/{slug}` did *not* help; the route pattern did. It re-renders every article page on its next visit, which is cheap because only one article's data expired |

**Trade-off:** `{ expire: 0 }` drops the last good copy. If legacy goes down *after* a webhook and *before*
anyone views that page, the page shows the friendly error state instead of the stale copy. Webhooks are sent
right after legacy saves (so legacy is up then), which makes the window small. The 60-second background refresh
still runs for changes nobody sends a webhook for.

### Metadata

`generateMetadata` uses the normalized article: `<title>` (with a site-wide template), a description from the
summary, a canonical URL, authors, keywords, and Open Graph `article` tags including `publishedTime`.

---

## Task 3: Transparent fallback

### Deciding which slugs are migrated

There is one list, `next-app/migration.json` (`hello-nextjs`, `typescript-tips`, `migrating-without-downtime`),
loaded by `src/config/migration.ts`. It is **re-read while the app runs**: migrating or rolling back a page is a
one-line edit that takes effect on the next request, with no restart or redeploy (like `IOptionsMonitor<T>` with
`reloadOnChange`). The path can be changed with `MIGRATION_FILE`, for example to a mounted config volume.

How the reload works:
- Each lookup checks the file's modification time (one `stat` call) and re-reads it only when it changed. A
  time-based cache was not an option, because Cache Components forbids `Date.now()` during prerendering, and
  the detail page reads the list while prerendering.
- **An invalid edit keeps the last good list** and logs once, so a typo can't roll back every migrated page.
- **The list deployed with the build is the fallback** until the live file has been read successfully, so a file
  that is already broken (or missing) when the app first needs it doesn't roll back every migrated page either.
  It is `migration.json` bundled at build time. Reading the file "at startup" instead would not work: Next.js
  loads the proxy and the pages as separate module instances, on first use, so a startup read would land in a
  copy they never see. Measured on a production build: a file broken before the first request kept serving the
  deployed list.
- **An invalid `migration.json` fails the build**, so a broken list can't be deployed in the first place.

What updates when, after an edit:

| Part | Updates | Why |
| --- | --- | --- |
| Routing (`proxy.ts`) | On the next request | Reads the list on every request |
| Detail page of a newly migrated slug | On the next request | Not prerendered, so it renders and caches on first visit |
| "New experience / Classic page" labels and link type on `/articles` | Within about a minute | The list page is cached and refreshed every 60s. A stale link still lands on the right system, because every request goes through the proxy |
| Pages prerendered at build | Never stale | Their slugs were migrated at build; if rolled back, the proxy simply stops sending traffic to them |

| Option | Pros | Cons |
| --- | --- | --- |
| **Config file, reloaded at runtime (chosen)** | Reviewed in pull requests, versioned, no runtime dependency, rollback is one line, no restart | On several servers, each needs the edited file (a shared volume or config map), and there are no per-user or percentage rollouts |
| Flag stored in the legacy data | Editors control it | Couples the old system to the new one, and needs a lookup per request |
| Feature-flag service | Instant, per-user or percentage rollouts | Extra infrastructure, too much for this slice |
| Ask Next first, fall back on a 404 | No list at all | Two hops per legacy request, and a page that was never migrated can't be told apart from a real 404 |

### Forwarding to legacy

1. **`proxy.ts`** (what Next.js 16 calls middleware) runs only for `/articles/:slug`. A migrated slug continues
   to the Next.js page. Anything else gets **`NextResponse.rewrite(legacyOrigin + path + query)`**.
   - It is a **rewrite, not a redirect**: the browser URL never changes, bookmarks and SEO links keep working,
     and there is no extra round trip.
   - The query string is passed through untouched. The legacy page echoes it, and an e2e test checks it.
   - An `x-served-by: next-app | legacy-php` response header makes the routing easy to see in DevTools or curl.
2. **The `fallback` rewrite in `next.config.ts`** sends *every other* URL Next.js has no route for
   (`/`, `/about.php`, `/article.php?id=3`, …) to legacy. Fallback rewrites run only after every Next.js page
   and asset has been checked, so they can never hide a migrated page.
3. **Links:** the list links to migrated articles with `<Link>` (client-side navigation) and to legacy
   articles with a plain `<a>`, so the browser does a full page load that the proxy can forward.

### Avoiding duplicated content

- **Content:** Next.js stores no content of its own. It reads from the PHP API, which stays the only source of
  truth, so there is nothing to keep in sync.
- **URLs:** each article has one canonical URL, `/articles/{slug}`, which is served by exactly one system
  at a time.
  - The detail page renders only if the slug is migrated (a second check, in case the proxy is bypassed).
  - The repository only accepts the canonical slug, so `/articles/1` (a numeric id that legacy also resolves)
    can never produce a second Next.js copy.
  - Migrated pages set `<link rel="canonical">`.
- **Next steps (out of scope):** once a page is migrated, legacy could 301-redirect its own direct URL
  (`:8000/articles/x`, `/article.php?id=1`) to the canonical one, and a sitemap could be generated from the
  migrated list.

### Trade-offs and limits

- **If legacy is down, unmigrated pages fail (HTTP 500)**, just as they would without Next.js. The rewrite
  can't serve content that only legacy has. A real deployment would put a friendly 502 page at the load
  balancer or CDN. Proxying through `fetch()` inside `proxy.ts` would allow a custom error page, but it means
  reimplementing header, cookie, method and body forwarding, which `rewrite` does correctly for free.
- **The proxy's runtime:** the proxy runs on every `/articles/:slug` request. It is cheap (one `stat` call and a
  `Set` lookup), and the matcher keeps it away from static assets.
- **Configuration timing:** `LEGACY_ORIGIN` is read when the app starts and when `next.config` builds its
  rewrites, so set it consistently for `build` and `start`.
- **The build needs legacy running**, because pages are pre-rendered from it. That is the right default for
  SSG (don't ship empty pages). A CI pipeline would start the PHP container first, as the Docker setup allows.
- **Long-term production:** the routing could move to the edge (Nginx, CloudFront, or YARP in a .NET shop), so
  the Next.js app doesn't proxy legacy traffic. The migration list stays the single source of truth either way.

---

## Patterns and standards

In one sentence: a **strangler-fig migration**, with the legacy system behind an **anti-corruption layer** and a
**ports-and-adapters** interface, organised in **layers** along **SOLID** lines, made resilient with
**timeouts, stale-while-revalidate caching and fail-safe configuration**, and operated with **Twelve-Factor**
config and **structured logging**.

### Migration architecture

| Pattern | Source | Where |
| --- | --- | --- |
| Strangler Fig | Martin Fowler | Next.js in front takes over page by page; the rest passes to PHP (`proxy.ts`, fallback in `next.config.ts`) |
| Reverse proxy / URL rewriting | Web infrastructure (YARP, Nginx) | `NextResponse.rewrite`, not a redirect: same URL, same query string |
| Feature toggles (release toggles) | Martin Fowler, Pete Hodgson | `migration.json` decides who serves each page, applied without a restart |

### Application architecture

| Pattern | Source | Where |
| --- | --- | --- |
| Anti-Corruption Layer | Domain-Driven Design (Eric Evans) | `lib/legacy/`: the legacy shape is translated to `Article` and never leaks out |
| Ports and Adapters (Hexagonal), for the data source | Alistair Cockburn | `ArticleSource` (port), `legacyArticleSource` (adapter) |
| Layered architecture | Classic n-tier | Pages → repository → queries → source → client |
| Repository | Martin Fowler, *PoEAA* | `lib/articles/repository.ts` |
| Composition root | Mark Seemann | The one line in `repository.ts` that picks the implementation |
| Options pattern with validation | .NET `IOptions<T>` + `ValidateOnStart` | `config/env.ts` |
| Logger abstraction | .NET `ILogger<T>` | `lib/logging/` |

### Design principles

| Principle | Where |
| --- | --- |
| SOLID: single responsibility | One job per module: transport, schema, mapping, rules, caching |
| SOLID: dependency inversion | Use cases depend on the `ArticleSource` interface, not on PHP |
| SOLID: open/closed | A new data source or logger is a new implementation; callers don't change |
| "Parse, don't validate" (Alexis King) | Zod at every boundary: legacy API, migration file, environment, webhook body |
| Functional core, imperative shell (Gary Bernhardt) | Normalization and use cases are pure; I/O stays at the edges |
| Fail fast | Invalid environment stops startup; an invalid migration list stops the build |

### Resilience

| Pattern | Where |
| --- | --- |
| Timeout | `AbortSignal.timeout` on every legacy call |
| Stale-while-revalidate (the idea behind RFC 5861) | Cached reads, background refresh, last good copy while legacy is down |
| Graceful degradation | Cached pages during an outage; otherwise a friendly error with **Try again** |
| Fail-safe defaults / last-known-good configuration | Broken `migration.json` → last good list → list deployed with the build |
| Event-driven cache invalidation | `notify-next.php` → `POST /api/revalidate` |

### Operations, security and the web

| Standard | Where |
| --- | --- |
| Twelve-Factor App (config in the environment, logs as an event stream) | Environment variables; logs to stdout |
| Structured logging (JSON lines) | Production log format |
| Bearer tokens (RFC 6750), constant-time comparison, secure by default | The webhook; disabled unless a secret is set |
| HTTP semantics | Rewrite vs redirect; 200 / 400 / 401 / 404 / 503 |
| Canonical URLs, Open Graph, ISO 8601 | Page metadata and the normalized date model |

### Framework and code quality

| Area | Standard |
| --- | --- |
| Next.js | Official App Router conventions: Server Components, Cache Components, Suspense streaming, `proxy.ts` / `route.ts` / `error.tsx` / `not-found.tsx` |
| TypeScript | Strict mode |
| Lint and format | ESLint (Next.js core-web-vitals + TypeScript rules), Prettier |
| Testing | Test pyramid (many unit tests, fewer end-to-end tests, a few browser tests with Playwright); test doubles (in-memory `ArticleSource`) |
| Git | Conventional Commits |

### Deliberately not applied

- **Full Clean Architecture / DDD:** no separate domain and use-case projects, and only the data source sits behind a
  port. For two pages that would add structure without benefit; the ideas are applied where they pay off.
- **A dependency-injection container:** wiring is one explicit line, partly because `"use cache"` functions can't
  receive injected objects.
- **A formal security review** (e.g. an OWASP checklist): only the one sensitive endpoint, the webhook, is hardened.

---

## Quality and testing

| Check | Command | Covers |
| --- | --- | --- |
| Unit tests (105) | `npm test` | Every normalization rule, the full real dataset (captured fixture + inline snapshot), the article use cases against an in-memory `ArticleSource`, the legacy source's validation and skipping of bad records, the migration list (live reload, invalid edits, missing file, deployed-list fallback), the revalidation webhook (auth, body validation, which tags and paths it expires), the logger (levels, pretty and JSON output, error serialization), proxy decisions and matcher, `next.config` rewrite rules, and the HTTP client's timeout / 404 / 5xx / invalid JSON handling |
| End-to-end tests (9) | `npm run test:e2e` | Against the running system: normalized list, migrated page and its metadata, rewrite to legacy that keeps the query string, legacy 404 passed through, fallback for `/`, `/about.php` and `/article.php?id=`, no duplicate page at `/articles/1`. Passes with PHP run locally **and** in Docker |
| Browser tests (3) | `npm run test:browser` | Playwright in headless Chromium against the running system, covering what plain HTTP checks can't see: a migrated article opens with **client-side navigation** (no full page load) with the right title; an unmigrated article is a **full page load** handed to legacy under the same URL, query string included; **Back and Forward** work across Next.js and legacy pages |
| Static checks | `npm run check` | Strict TypeScript, ESLint (Next core-web-vitals + TS), Prettier |
| PHP | `php -l` | Syntax of every file, `declare(strict_types=1)` everywhere, output escaped with `htmlspecialchars` |

Tested by hand:
- PHP killed while Next.js runs: migrated pages kept being served from cache.
- Cold start with PHP down: the friendly error page (screenshot checked).
- PHP slower than the timeout: the error appears after 5s.
- PHP slowed to 2s: the skeleton streams immediately, then the content.

### Environment-specific decisions

- **Plain CSS instead of Tailwind:** Turbopack's Tailwind loader fails when the project path contains `#`
  (e.g. `C:\Projects\C#\…`). The design is small, so one stylesheet with design tokens (light and dark)
  removes that build-time dependency.
- **Jest instead of Vitest:** for the same reason, Vite can't load test files from a path containing `#`.
  `next/jest` is the officially documented setup and compiles with Next's own SWC configuration.
