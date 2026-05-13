<?php
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── GET /api/auth.php?action=me ─────────────────────────────
if ($method === 'GET' && $action === 'me') {
    if (empty($_SESSION['user_id'])) {
        respond(['ok' => true, 'user' => null]);
    }
    $u = user_full($_SESSION['user_id']);
    respond(['ok' => true, 'user' => $u]);
}

// ── POST /api/auth.php?action=login ─────────────────────────
if ($method === 'POST' && $action === 'login') {
    $data     = body();
    $email    = strtolower(trim($data['email']    ?? ''));
    $password = trim($data['password'] ?? '');

    if (!$email || !$password) fail('Email and password are required.');

    $stmt = db()->prepare('SELECT id, password_hash, role FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        fail('Incorrect email or password.');
    }

    $_SESSION['user_id'] = $user['id'];
    respond(['ok' => true, 'user' => user_full($user['id'])]);
}

// ── POST /api/auth.php?action=register ──────────────────────
if ($method === 'POST' && $action === 'register') {
    $data     = body();
    $email    = strtolower(trim($data['email']    ?? ''));
    $password = trim($data['password'] ?? '');
    $name     = trim($data['name']     ?? '');

    if (!$email || !$password || !$name) fail('All fields are required.');
    if (strlen($password) < 6) fail('Password must be at least 6 characters.');

    $check = db()->prepare('SELECT id FROM users WHERE email = ?');
    $check->execute([$email]);
    if ($check->fetch()) fail('Email already registered.');

    $hash = password_hash($password, PASSWORD_DEFAULT);
    db()->prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, "customer")')
        ->execute([$email, $hash, $name]);

    $_SESSION['user_id'] = db()->lastInsertId();
    respond(['ok' => true, 'user' => user_full($_SESSION['user_id'])]);
}

// ── POST /api/auth.php?action=logout ────────────────────────
if ($method === 'POST' && $action === 'logout') {
    session_destroy();
    respond(['ok' => true]);
}

// ── POST /api/auth.php?action=google ────────────────────────
if ($method === 'POST' && $action === 'google') {
    $data  = body();
    $token = trim($data['accessToken'] ?? '');
    if (!$token) fail('Missing access token.');

    $raw  = @file_get_contents('https://www.googleapis.com/oauth2/v3/userinfo?access_token=' . urlencode($token));
    $info = $raw ? json_decode($raw, true) : null;

    if (empty($info['email'])) fail('Google sign-in failed. Could not retrieve your email.');

    $email   = strtolower($info['email']);
    $name    = $info['name']    ?? explode('@', $email)[0];
    $picture = $info['picture'] ?? null;

    $stmt = db()->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $existing = $stmt->fetch();

    if (!$existing) {
        db()->prepare('INSERT INTO users (email, name, role, picture_url) VALUES (?, ?, "customer", ?)')
            ->execute([$email, $name, $picture]);
        $uid = db()->lastInsertId();
    } else {
        $uid = $existing['id'];
        if ($picture) {
            db()->prepare('UPDATE users SET picture_url = ? WHERE id = ? AND (picture_url IS NULL OR picture_url = "")')
                ->execute([$picture, $uid]);
        }
    }

    $_SESSION['user_id'] = $uid;
    respond(['ok' => true, 'user' => user_full($uid)]);
}

// ── POST /api/auth.php?action=facebook ──────────────────────
if ($method === 'POST' && $action === 'facebook') {
    $data  = body();
    $token = trim($data['accessToken'] ?? '');
    if (!$token) fail('Missing access token.');

    $raw  = @file_get_contents('https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=' . urlencode($token));
    $info = $raw ? json_decode($raw, true) : null;

    if (empty($info['email'])) fail('Facebook sign-in failed. Make sure your Facebook email is public.');

    $email   = strtolower($info['email']);
    $name    = $info['name']                       ?? explode('@', $email)[0];
    $picture = $info['picture']['data']['url']     ?? null;

    $stmt = db()->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $existing = $stmt->fetch();

    if (!$existing) {
        db()->prepare('INSERT INTO users (email, name, role, picture_url) VALUES (?, ?, "customer", ?)')
            ->execute([$email, $name, $picture]);
        $uid = db()->lastInsertId();
    } else {
        $uid = $existing['id'];
        if ($picture) {
            db()->prepare('UPDATE users SET picture_url = ? WHERE id = ? AND (picture_url IS NULL OR picture_url = "")')
                ->execute([$picture, $uid]);
        }
    }

    $_SESSION['user_id'] = $uid;
    respond(['ok' => true, 'user' => user_full($uid)]);
}

// ── POST /api/auth.php?action=forgot_password ───────────────
// Step 1: called with {email} only → sends OTP
// Step 2: called with {email, code, password, confirmPassword} → resets password
if ($method === 'POST' && $action === 'forgot_password') {
    require __DIR__ . '/mailer.php';
    $data    = body();
    $email   = strtolower(trim($data['email']   ?? ''));
    $code    = trim($data['code']               ?? '');
    $newPwd  = trim($data['password']           ?? '');
    $confirm = trim($data['confirmPassword']    ?? '');

    if (!$email) fail('Email is required.');

    $stmt = db()->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user) fail('No account found with that email address.');

    // Step 1: send OTP
    if (!$code) {
        db()->prepare('UPDATE otps SET used = 1 WHERE email = ? AND purpose = "forgot_password"')
            ->execute([$email]);

        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        db()->prepare('INSERT INTO otps (email, code, purpose, expires_at) VALUES (?,?,"forgot_password", DATE_ADD(NOW(), INTERVAL 10 MINUTE))')
            ->execute([$email, $otp]);

        $sent = sendMail($email, "Chamilo's Pastry — Reset Password Code", otpEmailBody($otp, 'forgot_password'));
        if (!$sent) fail('Failed to send email. Please try again.');

        respond(['ok' => true, 'step' => 'otp_sent']);
    }

    // Step 2: verify OTP and reset
    if (!$newPwd) fail('New password is required.');
    if (strlen($newPwd) < 6) fail('Password must be at least 6 characters.');
    if ($newPwd !== $confirm) fail('Passwords do not match.');

    $otpRow = db()->prepare(
        'SELECT id FROM otps WHERE email = ? AND code = ? AND purpose = "forgot_password"
         AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1'
    );
    $otpRow->execute([$email, $code]);
    $otp = $otpRow->fetch();
    if (!$otp) fail('Invalid or expired verification code.');

    db()->prepare('UPDATE otps SET used = 1 WHERE id = ?')->execute([$otp['id']]);
    db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        ->execute([password_hash($newPwd, PASSWORD_DEFAULT), $user['id']]);

    respond(['ok' => true, 'step' => 'password_reset']);
}

fail('Invalid request.', 405);
