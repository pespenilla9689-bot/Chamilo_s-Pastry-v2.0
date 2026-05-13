<?php
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];

// ── GET /api/content.php ────────────────────────────────────
if ($method === 'GET') {
    $stmt = db()->query('SELECT content_key, content_value FROM site_content');
    $map  = [];
    foreach ($stmt->fetchAll() as $row) {
        $map[$row['content_key']] = $row['content_value'];
    }
    respond(['ok' => true, 'content' => $map]);
}

// ── POST /api/content.php ───────────────────────────────────
if ($method === 'POST') {
    require_role('admin');
    $data = body();
    if (empty($data)) fail('No data provided.');

    $stmt = db()->prepare('
        INSERT INTO site_content (content_key, content_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE content_value = VALUES(content_value)
    ');
    foreach ($data as $key => $value) {
        // Sanitize key: only alphanumeric + underscore
        $key = preg_replace('/[^a-zA-Z0-9_]/', '', $key);
        if ($key) $stmt->execute([$key, (string)$value]);
    }
    respond(['ok' => true]);
}

fail('Invalid request.', 405);
