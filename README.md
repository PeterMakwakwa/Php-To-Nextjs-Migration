# PHP → Next.js Phased Migration (Articles)

A small, realistic slice of a page-by-page migration from a legacy PHP site to Next.js + TypeScript.

| Directory      | What it is                                                                 | Port |
| -------------- | -------------------------------------------------------------------------- | ---- |
| `legacy-php/`  | Legacy system of record: messy Articles JSON API + legacy HTML pages        | 8000 |
| `next-app/`    | New Next.js (App Router, TypeScript) experience with transparent fallback   | 3000 |

Design decisions and trade-offs are in [SOLUTION.md](./SOLUTION.md).

## Prerequisites

- Node.js 20+ (`node -v`)
- **One of:** PHP 8.4+ installed locally (`php -v`) **or** Docker with Compose (`docker compose version`)

## Running locally

> Both apps run side-by-side. Always browse via **http://localhost:3000** — Next.js serves migrated
> pages itself and transparently forwards everything else to the legacy app.

```bash
# Terminal 1 — legacy PHP, option A: local PHP
cd legacy-php
php -S localhost:8000 router.php

# Terminal 1 — legacy PHP, option B: Docker (from the repo root)
docker compose up --build legacy-php
# stop with: docker compose down

# Verify either option
curl http://localhost:8000/api/health   # → {"status":"ok",...}

# Terminal 2 — Next.js
cd next-app
npm install
npm run dev
```

_Further sections (tests, configuration, demo URLs) are added as each phase lands._
