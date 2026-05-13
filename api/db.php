<?php
// ── Shared bootstrap for all API endpoints ──────────────────
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params(['samesite' => 'Lax', 'httponly' => true]);
    session_start();
}

header('Content-Type: application/json; charset=utf-8');

// ── Database config ─────────────────────────────────────────
define('DB_HOST',     'localhost');
define('DB_NAME',     'chamilos_pastry');
define('DB_USER',     'root');
define('DB_PASS',     '');
define('ADMIN_EMAIL', 'admin@chamilos.com');

// ── PDO singleton ───────────────────────────────────────────
function db() {
    static $pdo;
    if (!$pdo) {
        try {
            $pdo = new PDO(
                'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4',
                DB_USER, DB_PASS,
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }
    }
    return $pdo;
}

// ── Response helpers ────────────────────────────────────────
function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function fail($msg, $code = 400) {
    respond(['ok' => false, 'error' => $msg], $code);
}

// ── Request body helper ─────────────────────────────────────
function body() {
    static $data;
    if ($data === null) {
        $raw  = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? [];
    }
    return $data;
}

// ── Auth helpers ────────────────────────────────────────────
function auth_user() {
    if (empty($_SESSION['user_id'])) fail('Not authenticated', 401);
    $stmt = db()->prepare('SELECT id, email, name, role, phone FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $u = $stmt->fetch();
    if (!$u) {
        unset($_SESSION['user_id']);
        fail('Session expired', 401);
    }
    return $u;
}

function require_role($min_role) {
    $levels = ['customer' => 0, 'staff' => 1, 'manager' => 2, 'admin' => 3];
    $u      = auth_user();
    $have   = $levels[$u['role']] ?? 0;
    $need   = $levels[$min_role]  ?? 0;
    if ($have < $need) fail('Forbidden', 403);
    return $u;
}

// ── Full user with payment methods and addresses ─────────────
function user_full($id) {
    $stmt = db()->prepare('SELECT id, email, name, role, phone, title, avatar, picture_url FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $u = $stmt->fetch();
    if (!$u) return null;

    $pm = db()->prepare('SELECT method FROM user_payment_methods WHERE user_id = ? ORDER BY id');
    $pm->execute([$id]);
    $u['paymentMethods'] = $pm->fetchAll(PDO::FETCH_COLUMN);

    $sa = db()->prepare('SELECT address FROM user_saved_addresses WHERE user_id = ? ORDER BY id');
    $sa->execute([$id]);
    $u['savedAddresses'] = $sa->fetchAll(PDO::FETCH_COLUMN);

    return $u;
}
