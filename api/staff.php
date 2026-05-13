<?php
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── GET /api/staff.php ──────────────────────────────────────
if ($method === 'GET') {
    require_role('admin');
    $stmt = db()->query(
        "SELECT id, email, name, role, title, phone, created_at
         FROM users
         WHERE role IN ('staff','manager','admin')
         ORDER BY FIELD(role,'admin','manager','staff'), name ASC"
    );
    respond(['ok' => true, 'staff' => $stmt->fetchAll()]);
}

// ── POST /api/staff.php?action=create ───────────────────────
if ($method === 'POST' && $action === 'create') {
    require_role('admin');
    $data  = body();
    $name  = trim($data['name']     ?? '');
    $email = strtolower(trim($data['email']    ?? ''));
    $pwd   = trim($data['password'] ?? '');
    $title = trim($data['title']    ?? '');
    $role  = $data['role']          ?? 'staff';

    if (!$name || !$email || !$pwd) fail('All fields are required.');
    if (!in_array($role, ['staff', 'manager', 'admin'], true)) fail('Invalid role.');
    if ($email === ADMIN_EMAIL) fail('That email is reserved.');

    $check = db()->prepare('SELECT id FROM users WHERE email = ?');
    $check->execute([$email]);
    if ($check->fetch()) fail('A member with that email already exists.');

    $hash = password_hash($pwd, PASSWORD_DEFAULT);
    db()->prepare(
        'INSERT INTO users (email, password_hash, name, role, title) VALUES (?,?,?,?,?)'
    )->execute([$email, $hash, $name, $role, $title]);

    respond(['ok' => true]);
}

// ── POST /api/staff.php?action=delete ───────────────────────
if ($method === 'POST' && $action === 'delete') {
    require_role('admin');
    $email = strtolower(trim(body()['email'] ?? ''));
    if ($email === ADMIN_EMAIL) fail('Cannot remove the main admin account.');

    db()->prepare(
        "DELETE FROM users WHERE email = ? AND role != 'customer'"
    )->execute([$email]);
    respond(['ok' => true]);
}

fail('Invalid request.', 405);
