# legacy-php

Simulated legacy "Articles" system — the **system of record** during the migration.
Plain PHP 8.4, no framework, no database (data lives in `data/articles.php`).

## Run

```bash
php -S localhost:8000 router.php        # local PHP
docker compose up --build legacy-php    # or Docker, from the repo root
```

## Routes

| Route                          | Returns                                         |
| ------------------------------ | ----------------------------------------------- |
| `GET /api/health`              | `{"status":"ok"}`                               |
| `GET /api/articles`            | JSON array of raw (un-normalised) articles      |
| `GET /api/articles/{slug\|id}` | JSON article, `404` if unknown                  |
| `GET /articles`                | Legacy HTML list                                |
| `GET /articles/{slug\|id}`     | Legacy HTML article (echoes received query string) |
| `GET /article.php?id={id}`     | Very old URL style, still supported             |
| `GET /about.php`, `GET /`      | Example non-article legacy pages                |

## Simulating an unreliable legacy system

| Query / env var                    | Effect                               |
| ---------------------------------- | ------------------------------------ |
| `?delay=3000` / `LEGACY_DELAY_MS`  | Adds latency (ms, capped at 10 000)  |
| `?fail=1` / `LEGACY_FAIL=1`        | Responds `503 Service Unavailable`   |

`/api/health` is exempt so Docker's health check stays green.

## Data quirks (intentional)

See the header comment in [`data/articles.php`](data/articles.php): mixed field names, missing values,
five date formats, booleans as `1`/`"1"`/`"yes"`/`"true"`, and tags as comma-separated strings or arrays.
