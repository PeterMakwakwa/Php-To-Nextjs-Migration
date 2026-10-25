<?php

declare(strict_types=1);

/**
 * Server-rendered legacy HTML pages. These are what users see for any article that has
 * not been migrated yet — Next.js forwards those requests here under the same URL.
 */
final class Views
{
    public function __construct(private readonly ArticleRepository $repository)
    {
    }

    public function home(): void
    {
        self::layout('Home', '<h1>Legacy Site</h1><p><a href="/articles">Browse articles</a> · <a href="/about.php">About</a></p>');
    }

    public function about(): void
    {
        self::layout('About', '<h1>About</h1><p>This page has not been migrated and is still rendered by PHP.</p>');
    }

    public function listArticles(): void
    {
        $items = '';
        foreach ($this->repository->all() as $article) {
            $title = self::e((string) ($article['title'] ?? $article['headline'] ?? 'Untitled'));
            $slug = self::e((string) $article['slug']);
            $items .= "<li><a href=\"/articles/{$slug}\">{$title}</a></li>";
        }

        self::layout('Articles', "<h1>Articles</h1><ul>{$items}</ul>");
    }

    public function showArticle(string $identifier): void
    {
        $article = $this->repository->find($identifier);

        if ($article === null) {
            http_response_code(404);
            self::layout('Not found', '<h1>Article not found</h1><p><a href="/articles">Back to articles</a></p>');
            return;
        }

        $title = self::e((string) ($article['title'] ?? $article['headline'] ?? 'Untitled'));
        $author = self::e(trim((string) ($article['author'] ?? $article['author_name'] ?? 'Staff')));
        $body = nl2br(self::e((string) ($article['body'] ?? $article['content'] ?? '')));

        // Echo the query string so the fallback's parameter preservation is visible during review.
        $query = $_SERVER['QUERY_STRING'] ?? '';
        $queryNote = $query !== ''
            ? '<p class="query">Query parameters received by PHP: <code>?' . self::e($query) . '</code></p>'
            : '';

        self::layout($title, <<<HTML
            <p><a href="/articles">&larr; All articles</a></p>
            <article>
              <h1>{$title}</h1>
              <p class="meta">By {$author}</p>
              <div>{$body}</div>
            </article>
            {$queryNote}
            HTML);
    }

    public function notFound(): void
    {
        http_response_code(404);
        self::layout('Not found', '<h1>404 — Page not found</h1>');
    }

    private static function layout(string $title, string $content): void
    {
        header('Content-Type: text/html; charset=utf-8');
        echo <<<HTML
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>{$title} | Legacy Site</title>
              <style>
                body { font-family: Georgia, serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; color: #222; }
                .banner { background: #fff3cd; border: 1px solid #e0c36b; padding: .5rem .75rem; font: 14px sans-serif; }
                .meta, .query { color: #666; font: 14px sans-serif; }
              </style>
            </head>
            <body>
              <div class="banner">Served by the <strong>legacy PHP</strong> application</div>
              {$content}
            </body>
            </html>
            HTML;
    }

    private static function e(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
