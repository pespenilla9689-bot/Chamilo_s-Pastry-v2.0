<?php
require __DIR__ . '/db.php';
require __DIR__ . '/mailer.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── POST /api/otp.php?action=send ──────────────────────────────
if ($method === 'POST' && $action === 'send') {
    $data    = body();
    $email   = strtolower(trim($data['email']   ?? ''));
    $purpose = trim($data['purpose'] ?? '');

    if (!$email) fail('Email is required.');
    if (!in_array($purpose, ['forgot_password', 'change_password'], true)) fail('Invalid purpose.');

    $stmt = db()->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if (!$stmt->fetch()) fail('No account found with that email address.');

    // Invalidate previous codes
    db()->prepare('UPDATE otps SET used = 1 WHERE email = ? AND purpose = ?')
        ->execute([$email, $purpose]);

    $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

    db()->prepare('INSERT INTO otps (email, code, purpose, expires_at) VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))')
        ->execute([$email, $code, $purpose]);

    $sent = sendMail($email, "Chamilo's Pastry — Verification Code", otpEmailBody($code, $purpose));
    if (!$sent) fail('Failed to send email. Please check your email address or try again later.');

    respond(['ok' => true]);
}

// ── POST /api/otp.php?action=verify ────────────────────────────
if ($method === 'POST' && $action === 'verify') {
    $data    = body();
    $email   = strtolower(trim($data['email']   ?? ''));
    $code    = trim($data['code']               ?? '');
    $purpose = trim($data['purpose']            ?? '');

    if (!$email || !$code) fail('Email and code are required.');

    $stmt = db()->prepare(
        'SELECT id FROM otps
         WHERE email = ? AND code = ? AND purpose = ? AND used = 0 AND expires_at > NOW()
         ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([$email, $code, $purpose]);
    $otp = $stmt->fetch();

    if (!$otp) fail('Invalid or expired verification code.');

    // Mark used
    db()->prepare('UPDATE otps SET used = 1 WHERE id = ?')->execute([$otp['id']]);

    respond(['ok' => true]);
}

fail('Invalid request.', 405);
