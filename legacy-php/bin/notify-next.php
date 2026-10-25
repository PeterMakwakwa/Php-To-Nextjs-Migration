<?php

declare(strict_types=1);

/*
 * Tells the Next.js app that article content changed, so it drops its cached copy immediately
 * instead of waiting for its 60-second background refresh. A real legacy CMS would call this
 * from its "save article" hook; here it is run by hand after editing data/articles.php.
 *
 * Usage (from the legacy-php directory):
 *   php bin/notify-next.php caching-strategies    one article (and the article list)
 *   php bin/notify-next.php                       every article
 *
 * Environment:
 *   REVALIDATE_SECRET     required; must match REVALIDATE_SECRET in the Next.js app
 *   NEXT_REVALIDATE_URL   default http://localhost:3000/api/revalidate
 *
 * Uses PHP's built-in HTTP stream wrapper, so no curl extension is needed.
 */

$secret = getenv('REVALIDATE_SECRET') ?: '';
$url = getenv('NEXT_REVALIDATE_URL') ?: 'http://localhost:3000/api/revalidate';
$slug = $argv[1] ?? null;

if ($secret === '') {
    fwrite(STDERR, "REVALIDATE_SECRET is not set; it must match the Next.js app's REVALIDATE_SECRET.\n");
    exit(1);
}

$context = stream_context_create([
    'http' => [
        'method'        => 'POST',
        'header'        => "Content-Type: application/json\r\nAuthorization: Bearer {$secret}\r\n",
        'content'       => json_encode($slug === null ? new stdClass() : ['slug' => $slug]),
        'timeout'       => 5,
        'ignore_errors' => true, // return the body for 4xx/5xx instead of a bare warning
    ],
]);

$body = @file_get_contents($url, false, $context);
$statusLine = $http_response_header[0] ?? '';

if ($body === false || $statusLine === '') {
    fwrite(STDERR, "Could not reach {$url}. Is the Next.js app running?\n");
    exit(1);
}

$ok = (bool) preg_match('#^HTTP/\S+ 2\d\d#', $statusLine);
fwrite($ok ? STDOUT : STDERR, "{$statusLine}\n{$body}\n");
exit($ok ? 0 : 1);
