<?php
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── POST /api/users.php?action=update ───────────────────────
if ($method === 'POST' && $action === 'update') {
    $u    = auth_user();
    $data = body();

    $sets   = [];
    $params = [];

    $name    = trim($data['name']           ?? '');
    $phone   = trim($data['phone']          ?? '');
    $title   = $data['title']               ?? null;
    $oldPwd  = trim($data['oldPassword']    ?? '');
    $newPwd  = trim($data['password']       ?? '');
    $confirm = trim($data['confirmPassword']?? '');
    $otpCode = trim($data['otpCode']        ?? '');
    $avatar  = $data['avatar']              ?? null; // base64 data URL

    if ($name)           { $sets[] = 'name = ?';  $params[] = $name; }
    if ($phone !== '') {
        if (!preg_match('/^[0-9]{1,11}$/', $phone)) fail('Phone number must be digits only (max 11 digits).');
        $sets[]   = 'phone = ?';
        $params[] = $phone;
    }
    if ($title !== null) { $sets[] = 'title = ?'; $params[] = trim($title); }

    if ($avatar !== null) {
        if (!preg_match('/^data:image\/(jpeg|png|gif|webp);base64,/', $avatar)) {
            fail('Invalid image format.');
        }
        if (strlen($avatar) > 4 * 1024 * 1024) fail('Image must be under 3 MB.');
        $sets[]   = 'avatar = ?';
        $params[] = $avatar;
    }

    if ($newPwd) {
        if (strlen($newPwd) < 6) fail('New password must be at least 6 characters.');
        if ($newPwd !== $confirm) fail('Passwords do not match.');

        $row = db()->prepare('SELECT password_hash, email FROM users WHERE id = ?');
        $row->execute([$u['id']]);
        $userRow = $row->fetch();

        if ($userRow['password_hash'] && !$oldPwd) fail('Please enter your current password.');
        if ($userRow['password_hash'] && !password_verify($oldPwd, $userRow['password_hash'])) {
            fail('Current password is incorrect.');
        }

        // OTP verification required for password change
        if (!$otpCode) fail('Verification code is required to change your password.');

        $otpRow = db()->prepare(
            'SELECT id FROM otps WHERE email = ? AND code = ? AND purpose = "change_password"
             AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1'
        );
        $otpRow->execute([$userRow['email'], $otpCode]);
        $otp = $otpRow->fetch();
        if (!$otp) fail('Invalid or expired verification code.');

        db()->prepare('UPDATE otps SET used = 1 WHERE id = ?')->execute([$otp['id']]);

        $sets[]   = 'password_hash = ?';
        $params[] = password_hash($newPwd, PASSWORD_DEFAULT);
    }

    if ($sets) {
        $params[] = $u['id'];
        db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')
            ->execute($params);
    }

    respond(['ok' => true, 'user' => user_full($u['id'])]);
}

// ── POST /api/users.php?action=add_payment ──────────────────
if ($method === 'POST' && $action === 'add_payment') {
    $u   = auth_user();
    $val = trim(body()['method'] ?? '');
    if (!$val) fail('Method is required.');
    db()->prepare('INSERT IGNORE INTO user_payment_methods (user_id, method) VALUES (?, ?)')
        ->execute([$u['id'], $val]);
    respond(['ok' => true]);
}

// ── POST /api/users.php?action=remove_payment ───────────────
if ($method === 'POST' && $action === 'remove_payment') {
    $u   = auth_user();
    $val = trim(body()['method'] ?? '');
    db()->prepare('DELETE FROM user_payment_methods WHERE user_id = ? AND method = ?')
        ->execute([$u['id'], $val]);
    respond(['ok' => true]);
}

// ── POST /api/users.php?action=add_address ──────────────────
if ($method === 'POST' && $action === 'add_address') {
    $u    = auth_user();
    $addr = trim(body()['address'] ?? '');
    if (!$addr) fail('Address is required.');
    $check = db()->prepare('SELECT id FROM user_saved_addresses WHERE user_id = ? AND address = ?');
    $check->execute([$u['id'], $addr]);
    if (!$check->fetch()) {
        db()->prepare('INSERT INTO user_saved_addresses (user_id, address) VALUES (?, ?)')
            ->execute([$u['id'], $addr]);
    }
    respond(['ok' => true]);
}

// ── POST /api/users.php?action=remove_address ───────────────
if ($method === 'POST' && $action === 'remove_address') {
    $u    = auth_user();
    $addr = trim(body()['address'] ?? '');
    db()->prepare('DELETE FROM user_saved_addresses WHERE user_id = ? AND address = ?')
        ->execute([$u['id'], $addr]);
    respond(['ok' => true]);
}

fail('Invalid request.', 405);
