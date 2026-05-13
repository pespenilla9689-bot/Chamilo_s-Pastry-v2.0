<?php
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── GET /api/products.php ───────────────────────────────────
//  Returns all DB product rows (overrides + custom products).
//  Frontend merges these with the hardcoded MENU_CATALOG.
if ($method === 'GET') {
    $stmt = db()->query('SELECT * FROM products ORDER BY is_custom ASC, created_at ASC');
    respond(['ok' => true, 'products' => $stmt->fetchAll()]);
}

// ── POST /api/products.php?action=upsert ────────────────────
//  Add a new custom product OR update/override an existing one.
if ($method === 'POST' && $action === 'upsert') {
    require_role('manager');
    $data = body();

    $id        = trim($data['id']        ?? '');
    $name      = trim($data['name']      ?? '');
    $price     = floatval($data['price'] ?? 0);
    $tag       = trim($data['tag']       ?? '');
    $category  = $data['category']       ?? 'featured';
    $imagePath = trim($data['imagePath'] ?? '');
    $imageData = $data['imageData']      ?? '';
    $isCustom  = !empty($data['isCustom']) ? 1 : 0;

    if (!$id)           fail('Product id is required.');
    if (!$name || !$price) fail('Name and price are required.');
    if (!in_array($category, ['featured','signature','fullmenu'], true))
        fail('Invalid category.');

    $stmt = db()->prepare('
        INSERT INTO products (id, name, price, tag, image_path, image_data, category, is_custom, is_hidden)
        VALUES (?,?,?,?,?,?,?,?,0)
        ON DUPLICATE KEY UPDATE
            name       = VALUES(name),
            price      = VALUES(price),
            tag        = VALUES(tag),
            image_path = IF(VALUES(image_path) != "", VALUES(image_path), image_path),
            image_data = IF(VALUES(image_data) != "", VALUES(image_data), image_data),
            category   = VALUES(category),
            is_hidden  = 0
    ');
    $stmt->execute([$id, $name, $price, $tag, $imagePath, $imageData, $category, $isCustom]);
    respond(['ok' => true]);
}

// ── POST /api/products.php?action=hide ──────────────────────
//  Hides a base catalog product (soft delete).
if ($method === 'POST' && $action === 'hide') {
    require_role('manager');
    $id = trim(body()['id'] ?? '');
    if (!$id) fail('Product id is required.');

    // Upsert a hidden override row for base catalog products
    $stmt = db()->prepare('
        INSERT INTO products (id, name, price, category, is_hidden)
        VALUES (?, "", 0, "featured", 1)
        ON DUPLICATE KEY UPDATE is_hidden = 1
    ');
    $stmt->execute([$id]);
    respond(['ok' => true]);
}

// ── POST /api/products.php?action=delete ────────────────────
//  Permanently removes a custom product.
if ($method === 'POST' && $action === 'delete') {
    require_role('manager');
    $id = trim(body()['id'] ?? '');
    if (!$id) fail('Product id is required.');
    db()->prepare('DELETE FROM products WHERE id = ? AND is_custom = 1')->execute([$id]);
    respond(['ok' => true]);
}

fail('Invalid request.', 405);
