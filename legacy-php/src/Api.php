<?php

declare(strict_types=1);

/**
 * JSON endpoints consumed by the Next.js app.
 */
final class Api
{
    public function __construct(private readonly ArticleRepository $repository)
    {
    }

    public function health(): void
    {
        self::json(['status' => 'ok', 'php' => PHP_VERSION]);
    }

    /** GET /api/articles — returns a bare JSON array, as the legacy API always has. */
    public function listArticles(): void
    {
        self::json($this->repository->all());
    }

    /** GET /api/articles/{slug-or-id} */
    public function getArticle(string $identifier): void
    {
        $article = $this->repository->find($identifier);

        if ($article === null) {
            self::json(['error' => 'Article not found'], 404);
            return;
        }

        self::json($article);
    }

    public static function json(mixed $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
