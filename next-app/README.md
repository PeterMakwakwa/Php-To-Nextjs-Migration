# next-app

The new Articles experience — Next.js 16 (App Router, Cache Components), React 19, strict TypeScript.
See the [repository README](../README.md) for running both apps and [SOLUTION.md](../SOLUTION.md) for design decisions.

## Scripts

| Command                | What it does                                                           |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm run dev`          | Dev server on http://localhost:3000                                    |
| `npm run build`        | Production build (legacy PHP must be running — pages are prerendered)  |
| `npm start`            | Serve the production build                                             |
| `npm test`             | Unit tests (Jest) — no servers needed                                  |
| `npm run test:e2e`     | End-to-end tests against the running apps (:3000 and :8000)            |
| `npm run test:browser` | Browser tests (Playwright, headless Chromium) against the running apps |
| `npm run check`        | Typecheck + lint + format check + unit tests (CI gate)                 |
| `npm run format`       | Format everything with Prettier                                        |

## Layout

```
src/
├── proxy.ts                    # migration router: migrated slug → Next.js, otherwise → legacy (rewrite)
├── config/
│   ├── env.ts                  # validated, typed environment (fails fast)
│   └── migration.ts            # loads ../migration.json (which slugs are migrated), reloads on change
├── lib/
│   ├── legacy/
│   │   ├── client.ts           # HTTP client: timeout, status handling, typed errors
│   │   ├── schemas.ts          # Zod schema of the raw, messy legacy shape
│   │   ├── normalize.ts        # raw → Article (pure functions)
│   │   └── article-source.ts   # ArticleSource implementation: fetch → validate → normalize
│   ├── articles/
│   │   ├── model.ts            # normalized Article type
│   │   ├── source.ts           # ArticleSource interface (≈ IArticleSource)
│   │   ├── queries.ts          # use cases over any source: published, sorted, canonical slug
│   │   ├── repository.ts       # picks the source + caching; used by pages
│   │   └── cache-tags.ts       # cache tag names shared by the repository and the webhook
│   ├── logging/
│   │   ├── logger.ts           # Logger interface + levels (≈ ILogger<T>)
│   │   ├── console-logger.ts   # console implementation: level filter, pretty or JSON output
│   │   └── index.ts            # createLogger(scope), configured from LOG_LEVEL / LOG_FORMAT
│   └── format.ts
├── components/                 # ArticleCard, ArticleMeta, skeletons
└── app/
    ├── layout.tsx
    ├── global-error.tsx
    ├── api/revalidate/
    │   └── route.ts            # webhook: legacy reports a content change → cache expired now
    └── articles/
        ├── page.tsx            # list
        ├── error.tsx           # friendly error + retry (list and detail)
        └── [slug]/
            ├── page.tsx        # detail + generateMetadata + generateStaticParams
            └── not-found.tsx
tests/
├── unit/                       # normalize, queries, legacy source, migration list, proxy, webhook, logging, legacy client
├── e2e/                        # black-box checks of the running system
├── browser/                    # Playwright: client-side navigation, hand-off to legacy, Back/Forward
└── fixtures/legacy-articles.json   # captured real legacy API response
```
