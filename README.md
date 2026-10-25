# PHP → Next.js Phased Migration (Articles)

[![CI](https://github.com/PeterMakwakwa/Php-To-Nextjs-Migration/actions/workflows/ci.yml/badge.svg)](https://github.com/PeterMakwakwa/Php-To-Nextjs-Migration/actions/workflows/ci.yml)

A small, realistic slice of a page-by-page migration from a legacy PHP site to Next.js + TypeScript.

| Directory      | What it is                                                                 | Port |
| -------------- | -------------------------------------------------------------------------- | ---- |
| `legacy-php/`  | Legacy system of record: messy Articles JSON API + legacy HTML pages        | 8000 |
| `next-app/`    | New Next.js (App Router, TypeScript) experience with transparent fallback   | 3000 |

Design decisions and trade-offs are in **[SOLUTION.md](./SOLUTION.md)**.

## Prerequisites

- Node.js 20.9+ (`node -v`)
- **One of:** PHP 8.4+ installed locally (`php -v`) **or** Docker with Compose (`docker compose version`)

## Running locally

> Both apps run side-by-side. Always browse via **http://localhost:3000** — Next.js serves migrated
> pages itself and transparently forwards everything else to the legacy app.

Commands below are for macOS/Linux (bash/zsh). On Windows, see [Windows (PowerShell)](#windows-powershell).

### 1. Get the code

```bash
git clone https://github.com/PeterMakwakwa/Php-To-Nextjs-Migration.git
cd Php-To-Nextjs-Migration          # the repository root: every path below starts here
```

### 2. Start the legacy PHP app (terminal 1)

Option A, local PHP. `router.php` lives in `legacy-php/`, so PHP must be started **from that directory**
(otherwise: `Failed opening required 'router.php'`):

```bash
cd legacy-php
php -S localhost:8000 router.php     # stop with Ctrl+C
```

Option B, Docker, from the repository root:

```bash
docker compose up --build legacy-php # stop with Ctrl+C, then: docker compose down
```

Verify either option:

```bash
curl http://localhost:8000/api/health   # → {"status":"ok",...}
```

### 3. Start Next.js (terminal 2, from the repository root)

```bash
cd next-app
npm install                          # first time only
npm run dev                          # or: npm run build && npm start (production mode)
```

Open **http://localhost:3000/articles**.

Optional configuration: copy `next-app/.env.example` to `next-app/.env.local`. Every value has a working default.

### Port 3000 already in use?

Docker Desktop, Rancher Desktop (WSL) or another dev server may already listen on port 3000. Symptoms: a blank
page or an unrelated app on :3000, or every e2e test failing. Check with `lsof -i :3000` (macOS/Linux) or
`Get-NetTCPConnection -LocalPort 3000` (PowerShell), then either stop that program or run Next.js on another port:

```bash
npm run dev -- -p 3100               # then browse http://localhost:3100 instead of :3000
```

Everything in this README works the same on the other port; for the e2e tests see [Tests and checks](#tests-and-checks).

## What to try

| URL (on :3000)                                         | Served by | Shows                                                  |
| ------------------------------------------------------ | --------- | ------------------------------------------------------ |
| `/articles`                                            | Next.js   | All articles, normalized; badges show who serves each page |
| `/articles/hello-nextjs`                               | Next.js   | Migrated article + metadata                            |
| `/articles/typescript-tips`                            | Next.js   | Migrated (`headline`, UK date, array tags in legacy)   |
| `/articles/migrating-without-downtime`                 | Next.js   | Migrated (`"yes"` boolean, padded author, `tag_list`)  |
| `/articles/php-legacy-patterns?utm_source=newsletter`  | Legacy    | Same URL, query string preserved (echoed on the page)  |
| `/articles/caching-strategies`                         | Legacy    | Not migrated yet                                       |
| `/`, `/about.php`, `/article.php?id=3`                 | Legacy    | Rest of the old site via the fallback rewrite          |

`curl -I` any of these shows an `x-served-by: next-app | legacy-php` header for article URLs.

**Migrate another page:** add its slug to `next-app/migration.json` and save. **No restart needed:** the next
request to that URL is served by Next.js. Remove the slug again to roll back. (The "New experience / Classic page"
labels on `/articles` follow within about a minute, when that cached page refreshes.)

```json
{
  "migratedSlugs": ["hello-nextjs", "typescript-tips", "migrating-without-downtime", "caching-strategies"]
}
```

**See a content change immediately:** Next.js caches article content and refreshes it every 60 seconds. To show
an edit at once, legacy sends a "content changed" webhook, as a real CMS would on save.

1. Create `next-app/.env.local` with a shared secret, then restart Next.js (it reads `.env.local` at startup):
   ```bash
   REVALIDATE_SECRET=local-demo-secret-123
   ```
2. Change a title in `legacy-php/data/articles.php` and save. `/articles/hello-nextjs` still shows the old title.
3. From `legacy-php/`, send the webhook (same secret; set `NEXT_REVALIDATE_URL` if Next.js is not on port 3000):
   ```bash
   REVALIDATE_SECRET=local-demo-secret-123 php bin/notify-next.php hello-nextjs   # or no slug: every article
   ```
   Expected output: `HTTP/1.1 200 OK` and `{"revalidated":[...]}`.
4. Reload the page: the new title shows, on the article page and on the list. Undo your edit afterwards.

With PHP in Docker, the container reaches your machine as `host.docker.internal`:
`NEXT_REVALIDATE_URL=http://host.docker.internal:3000/api/revalidate`.

**Simulate a slow or broken legacy system** (restart PHP with one of these, then open a page that is not cached yet,
e.g. in a fresh `npm run dev`):

```bash
LEGACY_DELAY_MS=2000 php -S localhost:8000 router.php   # loading skeleton, then content
LEGACY_DELAY_MS=8000 php -S localhost:8000 router.php   # exceeds the 5s timeout → friendly error + retry
LEGACY_FAIL=1        php -S localhost:8000 router.php   # 503 from legacy → friendly error + retry
```

Already-cached pages keep being served while legacy is slow or down — that is intentional (see SOLUTION.md).
Stop PHP with Ctrl+C and **start it normally again when you are done**, otherwise later pages and the e2e tests
will look broken. The `VAR=value command` form above only applies to that one command, so a plain restart is enough;
if you used `export` (or PowerShell, below), clear the variables first.

## Tests and checks

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of these on every push and pull request:
static checks and unit tests first, then a production build against the dockerized legacy app, the end-to-end
suite and the browser tests. Locally:

```bash
cd next-app
npm run check        # typecheck + lint + format check + unit tests (no servers needed)
npm run test:e2e     # end-to-end, with both apps running normally (no LEGACY_DELAY_MS / LEGACY_FAIL)
npm run test:browser # browser tests (Playwright, headless Chromium), with both apps running normally
```

The browser tests need Playwright's Chromium once per machine: `npx playwright install chromium`. On a failure,
Playwright keeps a trace in `next-app/test-results/`; open it with `npx playwright show-trace <path-to-trace.zip>`.

The e2e and browser tests expect Next.js on http://localhost:3000 and PHP on http://localhost:8000. If Next.js
runs on another port (see [Port 3000 already in use?](#port-3000-already-in-use)), point them at it:

```bash
APP_URL=http://localhost:3100 npm run test:e2e       # LEGACY_URL overrides the PHP origin the same way
APP_URL=http://localhost:3100 npm run test:browser
```

## Windows (PowerShell)

The steps are the same; only the shell syntax differs. Quote paths, since folders such as `C#` contain special
characters.

```powershell
# Terminal 1 — legacy PHP
cd "<repository-root>\legacy-php"
php -S localhost:8000 router.php

# Verify. Use curl.exe: in Windows PowerShell 5.1 plain `curl` is an alias for Invoke-WebRequest.
curl.exe http://localhost:8000/api/health

# Terminal 2 — Next.js
cd "<repository-root>\next-app"
npm install
npm run dev                                   # or: npm run dev -- -p 3100

# Routing header
curl.exe -I http://localhost:3000/articles/caching-strategies
```

Simulating a slow or broken legacy system. Unlike bash, `$env:` variables **stay set for the rest of that
PowerShell window**, so clear them afterwards (or close the window):

```powershell
$env:LEGACY_DELAY_MS=2000; php -S localhost:8000 router.php   # or 8000 for the timeout
$env:LEGACY_FAIL=1;        php -S localhost:8000 router.php

# Back to normal
Remove-Item Env:LEGACY_DELAY_MS, Env:LEGACY_FAIL -ErrorAction SilentlyContinue
php -S localhost:8000 router.php
```

Content-change webhook (after creating `next-app\.env.local` as above and restarting Next.js):

```powershell
cd "<repository-root>\legacy-php"
$env:REVALIDATE_SECRET="local-demo-secret-123"
$env:NEXT_REVALIDATE_URL="http://localhost:3100/api/revalidate"   # only if Next.js is not on port 3000
php bin/notify-next.php hello-nextjs
```

Tests:

```powershell
cd "<repository-root>\next-app"
npm run check
$env:APP_URL="http://localhost:3100"                           # set APP_URL only if not on port 3000
npm run test:e2e
npx playwright install chromium                                 # once per machine
npm run test:browser
```
