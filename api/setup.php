<?php
// ── One-time setup: seeds the admin account ─────────────────
// 1. Import schema.sql in phpMyAdmin
// 2. Visit http://localhost/api/setup.php once in your browser
// 3. DELETE this file after it runs!

require __DIR__ . '/db.php';

try {
    $hash = password_hash('admin123', PASSWORD_DEFAULT);
    $stmt = db()->prepare(
        'INSERT INTO users (email, password_hash, name, role)
         VALUES (?, ?, "Admin", "admin")
         ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role)'
    );
    $stmt->execute([ADMIN_EMAIL, $hash]);

    respond([
        'ok'      => true,
        'message' => 'Admin account seeded successfully. DELETE this file now!'
    ]);
} catch (Exception $e) {
    fail($e->getMessage(), 500);
}
