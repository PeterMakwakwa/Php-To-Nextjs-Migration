<?php

declare(strict_types=1);

// Front controller for PHP's built-in server: every request is routed through this file.
// Full routing (articles API + legacy HTML pages) is added in phase 2.

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($path === '/api/health') {
    header('Content-Type: application/json');
    echo json_encode(['status' => 'ok', 'php' => PHP_VERSION]);
    return;
}

http_response_code(404);
header('Content-Type: text/plain');
echo "Not Found\n";
