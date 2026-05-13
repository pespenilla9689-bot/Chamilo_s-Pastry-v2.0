<?php
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── GET /api/orders.php?action=has_ordered ──────────────────
if ($method === 'GET' && $action === 'has_ordered') {
    $u    = auth_user();
    $stmt = db()->prepare('SELECT COUNT(*) FROM orders WHERE user_id = ?');
    $stmt->execute([$u['id']]);
    respond(['ok' => true, 'hasOrdered' => (int)$stmt->fetchColumn() > 0]);
}

// ── GET /api/orders.php ─────────────────────────────────────
if ($method === 'GET') {
    $u    = auth_user();
    $lvl  = ['customer' => 0, 'staff' => 1, 'manager' => 2, 'admin' => 3];
    $role = $lvl[$u['role']] ?? 0;

    if ($role >= 1) {
        $stmt = db()->query('SELECT * FROM orders ORDER BY created_at DESC');
    } else {
        $stmt = db()->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
        $stmt->execute([$u['id']]);
    }

    $orders = $stmt->fetchAll();
    foreach ($orders as &$order) {
        $items = db()->prepare('SELECT * FROM order_items WHERE order_id = ?');
        $items->execute([$order['id']]);
        $order['items'] = $items->fetchAll();
        $order['customer'] = [
            'name'  => $order['customer_name'],
            'phone' => $order['customer_phone'],
            'email' => $order['customer_email'],
        ];
        $order['deliveryMethod']      = $order['delivery_method'];
        $order['preferredDate']       = $order['preferred_date'] ?? '';
        $order['cakeMessage']         = $order['cake_message'] ?? '';
        $order['specialInstructions'] = $order['special_instructions'] ?? '';
        $order['payment']             = $order['payment_method'];
        $order['date']                = $order['created_at'];
        $order['id']                  = $order['order_ref'];
    }
    respond(['ok' => true, 'orders' => $orders]);
}

// ── POST /api/orders.php?action=create ──────────────────────
if ($method === 'POST' && $action === 'create') {
    $u    = auth_user();
    $data = body();

    $name  = trim($data['customerName']  ?? '');
    $phone = trim($data['customerPhone'] ?? '');
    if (!$name || !$phone) fail('Name and phone are required.');

    $count = (int)db()->query('SELECT COUNT(*) FROM orders')->fetchColumn();
    $ref   = 'ORD-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);

    $exists = db()->prepare('SELECT id FROM orders WHERE order_ref = ?');
    $exists->execute([$ref]);
    while ($exists->fetch()) {
        $count++;
        $ref = 'ORD-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);
        $exists->execute([$ref]);
    }

    $prefDate = $data['preferredDate'] ?? null;
    if (empty($prefDate)) $prefDate = null;

    $stmt = db()->prepare('
        INSERT INTO orders (
          order_ref, user_id, customer_name, customer_phone, customer_email,
          delivery_method, address, preferred_date, cake_message,
          special_instructions, payment_method, total, status
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ');
    $stmt->execute([
        $ref,
        $u['id'],
        $name,
        $phone,
        trim($data['customerEmail']       ?? ''),
        $data['deliveryMethod']            ?? 'pickup',
        trim($data['address']              ?? ''),
        $prefDate,
        trim($data['cakeMessage']          ?? ''),
        trim($data['specialInstructions']  ?? ''),
        $data['paymentMethod']             ?? 'gcash',
        floatval($data['total']            ?? 0),
        'pending',
    ]);
    $orderId = db()->lastInsertId();

    $iStmt = db()->prepare(
        'INSERT INTO order_items (order_id, product_ref, name, price, qty, image)
         VALUES (?,?,?,?,?,?)'
    );
    foreach ($data['items'] ?? [] as $item) {
        $iStmt->execute([
            $orderId,
            $item['id']    ?? '',
            $item['name']  ?? '',
            floatval($item['price'] ?? 0),
            intval($item['qty']     ?? 1),
            $item['image'] ?? '',
        ]);
    }

    if (!empty($data['saveAddress']) && !empty($data['address'])) {
        $addr  = trim($data['address']);
        $check = db()->prepare(
            'SELECT id FROM user_saved_addresses WHERE user_id = ? AND address = ?'
        );
        $check->execute([$u['id'], $addr]);
        if (!$check->fetch()) {
            db()->prepare('INSERT INTO user_saved_addresses (user_id, address) VALUES (?,?)')
                ->execute([$u['id'], $addr]);
        }
    }

    respond(['ok' => true, 'orderId' => $ref]);
}

// ── POST /api/orders.php?action=update_status ───────────────
if ($method === 'POST' && $action === 'update_status') {
    require_role('staff');
    $data   = body();
    $ref    = $data['orderId'] ?? '';
    $status = $data['status']  ?? '';
    $valid  = ['pending', 'processing', 'ready-for-pickup', 'delivered', 'cancelled'];

    if (!in_array($status, $valid, true)) fail('Invalid status.');

    $row = db()->prepare('SELECT id, status FROM orders WHERE order_ref = ?');
    $row->execute([$ref]);
    $order = $row->fetch();
    if (!$order) fail('Order not found.');

    if ($status === 'cancelled') {
        if ($order['status'] !== 'pending') fail('Only pending orders can be cancelled.');
        db()->prepare('DELETE FROM order_items WHERE order_id = ?')->execute([$order['id']]);
        db()->prepare('DELETE FROM orders WHERE id = ?')->execute([$order['id']]);
    } else {
        db()->prepare('UPDATE orders SET status = ? WHERE order_ref = ?')
            ->execute([$status, $ref]);
    }

    respond(['ok' => true]);
}

// ── POST /api/orders.php?action=cancel_item ─────────────────
if ($method === 'POST' && $action === 'cancel_item') {
    $u      = auth_user();
    $data   = body();
    $ref    = $data['orderId'] ?? '';
    $itemId = intval($data['itemId'] ?? 0);

    if (!$ref || !$itemId) fail('Order ID and item ID are required.');

    $lvl  = ['customer' => 0, 'staff' => 1, 'manager' => 2, 'admin' => 3];
    $role = $lvl[$u['role']] ?? 0;

    $row = db()->prepare('SELECT id, user_id, status FROM orders WHERE order_ref = ?');
    $row->execute([$ref]);
    $order = $row->fetch();
    if (!$order) fail('Order not found.');

    // Customers can only cancel their own orders
    if ($role < 1 && $order['user_id'] != $u['id']) fail('Forbidden.', 403);

    if ($order['status'] !== 'pending') fail('Items can only be cancelled on pending orders.');

    // Verify item belongs to this order
    $item = db()->prepare('SELECT id, price, qty FROM order_items WHERE id = ? AND order_id = ?');
    $item->execute([$itemId, $order['id']]);
    $orderItem = $item->fetch();
    if (!$orderItem) fail('Item not found in this order.');

    db()->prepare('DELETE FROM order_items WHERE id = ?')->execute([$itemId]);

    // Count remaining items
    $remaining = db()->prepare('SELECT COUNT(*), COALESCE(SUM(price * qty), 0) FROM order_items WHERE order_id = ?');
    $remaining->execute([$order['id']]);
    [$count, $newTotal] = $remaining->fetch(PDO::FETCH_NUM);

    if ($count == 0) {
        // No items left — delete the whole order
        db()->prepare('DELETE FROM orders WHERE id = ?')->execute([$order['id']]);
        respond(['ok' => true, 'orderDeleted' => true]);
    }

    db()->prepare('UPDATE orders SET total = ? WHERE id = ?')->execute([$newTotal, $order['id']]);
    respond(['ok' => true, 'orderDeleted' => false, 'newTotal' => $newTotal]);
}

fail('Invalid request.', 405);
