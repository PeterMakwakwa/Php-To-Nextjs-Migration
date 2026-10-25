<?php

declare(strict_types=1);

/**
 * Read-only access to the fixed article dataset.
 * Records are returned exactly as stored — the legacy system does not normalise anything.
 */
final class ArticleRepository
{
    /** @var list<array<string, mixed>> */
    private array $articles;

    public function __construct(string $dataFile)
    {
        $this->articles = require $dataFile;
    }

    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        return $this->articles;
    }

    /**
     * Finds an article by its slug, or by its numeric id for older links (e.g. ?id=3).
     *
     * @return array<string, mixed>|null
     */
    public function find(string $identifier): ?array
    {
        foreach ($this->articles as $article) {
            $id = (string) ($article['id'] ?? $article['article_id'] ?? '');
            if ($article['slug'] === $identifier || $id === $identifier) {
                return $article;
            }
        }

        return null;
    }
}
