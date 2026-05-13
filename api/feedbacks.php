<?php
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── GET /api/feedbacks.php?action=featured ──────────────────
if ($method === 'GET' && $action === 'featured') {
    $stmt = db()->query(
        'SELECT name, occasion, comment, rating, created_at
         FROM feedbacks
         WHERE rating >= 4
         ORDER BY is_featured DESC, created_at DESC
         LIMIT 6'
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['date'] = date('M j, Y', strtotime($row['created_at']));
    }
    respond(['ok' => true, 'feedbacks' => $rows]);
}

// ── GET /api/feedbacks.php ──────────────────────────────────
if ($method === 'GET') {
    $stmt = db()->query(
        'SELECT id, name, occasion, comment, rating, is_featured, created_at
         FROM feedbacks ORDER BY created_at DESC'
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['date']        = date('M j, Y', strtotime($row['created_at']));
        $row['is_featured'] = (bool)$row['is_featured'];
    }
    respond(['ok' => true, 'feedbacks' => $rows]);
}

// ── POST /api/feedbacks.php?action=toggle_featured ──────────
if ($method === 'POST' && $action === 'toggle_featured') {
    require_role('admin');
    $id = intval(body()['id'] ?? 0);
    if (!$id) fail('Invalid feedback ID.');
    db()->prepare('UPDATE feedbacks SET is_featured = NOT is_featured WHERE id = ?')->execute([$id]);
    respond(['ok' => true]);
}

// ── POST /api/feedbacks.php?action=delete ───────────────────
if ($method === 'POST' && $action === 'delete') {
    require_role('admin');
    $id = intval(body()['id'] ?? 0);
    if (!$id) fail('Invalid feedback ID.');
    db()->prepare('DELETE FROM feedbacks WHERE id = ?')->execute([$id]);
    respond(['ok' => true]);
}

// ── POST /api/feedbacks.php ─────────────────────────────────
if ($method === 'POST') {
    $u    = auth_user();
    $data = body();

    $rating   = intval($data['rating']   ?? 0);
    $name     = trim($data['name']       ?? '');
    $occasion = trim($data['occasion']   ?? '');
    $comment  = trim($data['comment']    ?? '');

    if ($rating < 1 || $rating > 5) fail('Rating must be between 1 and 5.');
    if (!$name)    fail('Name is required.');
    if (!$comment) fail('Comment is required.');

    $check = db()->prepare('SELECT COUNT(*) FROM orders WHERE user_id = ?');
    $check->execute([$u['id']]);
    if ((int)$check->fetchColumn() === 0) {
        fail('You must place an order before leaving a review.', 403);
    }

    db()->prepare(
        'INSERT INTO feedbacks (user_id, name, occasion, comment, rating) VALUES (?,?,?,?,?)'
    )->execute([$u['id'], $name, $occasion, $comment, $rating]);

    respond(['ok' => true]);
}

fail('Invalid request.', 405);
