<?php
require __DIR__ . '/db.php';
require __DIR__ . '/mailer.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── POST /api/vouchers.php?action=subscribe ──────────────────────
// Guest subscribes with name + email for first-order 10% off voucher
if ($method === 'POST' && $action === 'subscribe') {
    $data  = body();
    $email = strtolower(trim($data['email'] ?? ''));
    $name  = trim($data['name'] ?? '');

    if (!$email || !$name) fail('Name and email are required.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Invalid email address.');

    // Check if already subscribed
    $check = db()->prepare('SELECT code FROM vouchers WHERE email = ?');
    $check->execute([$email]);
    $existing = $check->fetch();

    if ($existing) {
        respond(['ok' => true, 'code' => $existing['code'], 'alreadyClaimed' => true]);
    }

    $code = 'CHAMILO-' . strtoupper(substr(md5($email . time()), 0, 6));
    $exp  = date('Y-m-d H:i:s', strtotime('+30 days'));

    db()->prepare('INSERT INTO vouchers (code, email, discount, type, expires_at) VALUES (?,?,10.00,"percent",?)')
        ->execute([$code, $email, $exp]);

    // Send voucher email
    $body = "
    <div style='font-family:Poppins,sans-serif;max-width:480px;margin:0 auto;padding:32px;
                background:#fff;border-radius:20px;border:1px solid #e8d5ff'>
      <h2 style='color:#4a3668;margin:0 0 8px'>Welcome, {$name}!</h2>
      <p style='color:#7a6675;margin:0 0 24px;font-size:0.9rem'>Thank you for subscribing to Chamilo's Pastry</p>
      <p style='color:#3d3047;font-size:0.95rem;margin:0 0 12px'>Here is your <strong>10% off</strong> voucher for your first order:</p>
      <div style='font-size:1.8rem;font-weight:700;letter-spacing:0.2em;color:#7a5fa8;
                  background:#f5f0ff;border-radius:14px;padding:18px;text-align:center;
                  margin-bottom:20px'>{$code}</div>
      <p style='color:#9a849f;font-size:0.82rem;margin:0'>
        Enter this code at checkout. Valid for 30 days.
      </p>
    </div>";

    sendMail($email, "Chamilo's Pastry — Your 10% Off Voucher", $body);

    respond(['ok' => true, 'code' => $code]);
}

// ── POST /api/vouchers.php?action=claim ─────────────────────────
// Logged-in customer claims their first-order voucher
if ($method === 'POST' && $action === 'claim') {
    $u = auth_user();

    $check = db()->prepare('SELECT code, used FROM vouchers WHERE email = ?');
    $check->execute([$u['email']]);
    $existing = $check->fetch();

    if ($existing) {
        respond(['ok' => true, 'code' => $existing['code'], 'used' => (bool)$existing['used']]);
    }

    $code = 'CHAMILO-' . strtoupper(substr(md5($u['email'] . time()), 0, 6));
    $exp  = date('Y-m-d H:i:s', strtotime('+30 days'));

    db()->prepare('INSERT INTO vouchers (code, email, discount, type, expires_at) VALUES (?,?,10.00,"percent",?)')
        ->execute([$code, $u['email'], $exp]);

    respond(['ok' => true, 'code' => $code, 'used' => false]);
}

// ── POST /api/vouchers.php?action=apply ─────────────────────────
// Validate a voucher code at checkout
if ($method === 'POST' && $action === 'apply') {
    $data  = body();
    $code  = strtoupper(trim($data['code'] ?? ''));
    $total = floatval($data['total'] ?? 0);

    if (!$code) fail('Voucher code is required.');

    $stmt = db()->prepare(
        'SELECT * FROM vouchers WHERE code = ? AND used = 0
         AND (expires_at IS NULL OR expires_at > NOW())'
    );
    $stmt->execute([$code]);
    $v = $stmt->fetch();

    if (!$v) fail('Invalid or expired voucher code.');

    $discount = $v['type'] === 'percent'
        ? round($total * ($v['discount'] / 100), 2)
        : min($v['discount'], $total);

    respond(['ok' => true, 'discount' => $discount, 'discountPct' => $v['discount'], 'type' => $v['type']]);
}

// ── POST /api/vouchers.php?action=redeem ────────────────────────
// Mark voucher as used after successful order
if ($method === 'POST' && $action === 'redeem') {
    $code = strtoupper(trim(body()['code'] ?? ''));
    if (!$code) fail('Code required.');
    db()->prepare('UPDATE vouchers SET used = 1 WHERE code = ?')->execute([$code]);
    respond(['ok' => true]);
}

fail('Invalid request.', 405);
