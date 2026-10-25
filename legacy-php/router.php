<?php

declare(strict_types=1);

/*
 * Front controller for PHP's built-in server: every request is routed through this file.
 *
 *   GET /api/health                  health check
 *   GET /api/articles                JSON list (raw, un-normalised records)
 *   GET /api/articles/{slug|id}      JSON single article, 404 if unknown
 *   GET /                            legacy home page
 *   GET /about.php                   example legacy page outside the Articles section
 *   GET /articles                    legacy HTML list
 *   GET /articles/{slug|id}          legacy HTML article
 *   GET /article.php?id={id}         very old URL style, still in the wild
 *
 * Simulating an unreliable legacy system (handy for testing loading/error states):
 *   ?delay=<ms>    or env LEGACY_DELAY_MS   add latency to every request (capped at 10s)
 *   ?fail=1        or env LEGACY_FAIL=1     respond with HTTP 503
 */

require __DIR__ . '/src/ArticleRepository.php';
require __DIR__ . '/src/Api.php';
require __DIR__ . '/src/Views.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = rtrim($path, '/') ?: '/';

if ($path === '/api/health') {
    (new Api(new ArticleRepository(__DIR__ . '/data/articles.php')))->health();
    return;
}

simulateUnreliability();

$repository = new ArticleRepository(__DIR__ . '/data/articles.php');
$api = new Api($repository);
$views = new Views($repository);

match (true) {
    $path === '/api/articles'                                        => $api->listArticles(),
    (bool) preg_match('#^/api/articles/([\w-]+)$#', $path, $m)       => $api->getArticle($m[1]),
    $path === '/'                                                    => $views->home(),
    $path === '/about.php'                                           => $views->about(),
    $path === '/articles'                                            => $views->listArticles(),
    (bool) preg_match('#^/articles/([\w-]+)$#', $path, $m)           => $views->showArticle($m[1]),
    $path === '/article.php' && isset($_GET['id'])                   => $views->showArticle((string) $_GET['id']),
    str_starts_with($path, '/api/')                                  => Api::json(['error' => 'Not found'], 404),
    default                                                          => $views->notFound(),
};

function simulateUnreliability(): void
{
    $delayMs = (int) ($_GET['delay'] ?? getenv('LEGACY_DELAY_MS') ?: 0);
    if ($delayMs > 0) {
        usleep(min($delayMs, 10_000) * 1000);
    }

    if (($_GET['fail'] ?? getenv('LEGACY_FAIL')) === '1') {
        Api::json(['error' => 'Legacy service unavailable'], 503);
        exit;
    }
}
