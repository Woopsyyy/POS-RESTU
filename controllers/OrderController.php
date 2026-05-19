<?php
/**
 * Loren Eatery POS - Order Controller
 * Handles order creation, status updates, history, and CSV export
 */

class OrderController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function handle(string $action, string $method): void {
        switch ($action) {
            case 'create':
                if ($method === 'POST') $this->createOrder();
                else sendError('Method not allowed', 405);
                break;
            case 'list':
                $this->listOrders();
                break;
            case 'get':
                $this->getOrder();
                break;
            case 'status':
                if ($method === 'POST') { requireAdminAuth(); $this->updateStatus(); }
                else sendError('Method not allowed', 405);
                break;
            case 'ready':
                $this->getReadyOrders();
                break;
            case 'pending-count':
                $this->getPendingCount();
                break;
            case 'history':
                requireAdminAuth(); $this->getHistory();
                break;
            case 'export':
                requireAdminAuth(); $this->exportCSV();
                break;
            case 'cancel':
                if ($method === 'POST') { requireAdminAuth(); $this->cancelOrder(); }
                else sendError('Method not allowed', 405);
                break;
            default:
                sendError('Unknown order action', 404);
        }
    }

    private function createOrder(): void {
        $body = getRequestBody();
        requireFields($body, ['customer_name', 'items', 'total_amount', 'payment_amount']);

        $customerName  = sanitize($body['customer_name']);
        $items         = $body['items'];
        $totalAmount   = (float)$body['total_amount'];
        $paymentAmount = (float)$body['payment_amount'];
        $changeAmount  = $paymentAmount - $totalAmount;
        $notes         = sanitize($body['notes'] ?? '');

        if (!is_array($items) || empty($items)) {
            sendError('Order must contain at least one item.', 422);
        }

        if ($paymentAmount < $totalAmount) {
            sendError('Insufficient payment amount.', 422);
        }

        // Estimate wait time based on number of items
        $itemCount   = array_sum(array_column($items, 'quantity'));
        $estimatedWait = max(5, min(30, $itemCount * 2));

        $this->db->beginTransaction();
        try {
            // Generate queue number
            $queueNumber = generateQueueNumber($this->db);
            $today = date('Y-m-d');

            // Insert order
            $stmt = $this->db->prepare(
                "INSERT INTO orders (queue_number, customer_name, total_amount, payment_amount,
                 change_amount, notes, estimated_wait, order_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $queueNumber, $customerName, $totalAmount, $paymentAmount,
                $changeAmount, $notes, $estimatedWait, $today
            ]);
            $orderId = (int)$this->db->lastInsertId();

            // Insert order items
            $itemStmt = $this->db->prepare(
                "INSERT INTO order_items (order_id, menu_item_id, item_name, item_price, quantity, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?)"
            );
            foreach ($items as $item) {
                $menuItemId = isset($item['menu_item_id']) ? (int)$item['menu_item_id'] : null;
                $itemName   = sanitize($item['name'] ?? 'Unknown Item');
                $itemPrice  = (float)($item['price'] ?? 0);
                $qty        = (int)($item['quantity'] ?? 1);
                $subtotal   = $itemPrice * $qty;

                $itemStmt->execute([$orderId, $menuItemId, $itemName, $itemPrice, $qty, $subtotal]);
            }

            // Log activity (optional admin context)
            $adminId = $_SESSION['admin_id'] ?? null;
            logActivity($this->db, $adminId, 'ORDER_CREATE',
                "New order #{$queueNumber} for {$customerName} — ₱{$totalAmount}");

            $this->db->commit();

            sendSuccess([
                'order_id'      => $orderId,
                'queue_number'  => $queueNumber,
                'customer_name' => $customerName,
                'total_amount'  => $totalAmount,
                'change_amount' => $changeAmount,
                'estimated_wait' => $estimatedWait,
                'created_at'    => date('c'),
            ], 'Order placed successfully!', 201);

        } catch (Exception $e) {
            $this->db->rollBack();
            sendError('Failed to save order: ' . $e->getMessage(), 500);
        }
    }

    private function listOrders(): void {
        // Admin-only filtering
        $status     = $_GET['status'] ?? null;
        $search     = $_GET['search'] ?? null;
        $date       = $_GET['date']   ?? date('Y-m-d');

        $sql    = "SELECT o.*, COUNT(oi.id) as item_count
                   FROM orders o
                   LEFT JOIN order_items oi ON oi.order_id = o.id
                   WHERE o.order_date = ?";
        $params = [$date];

        if ($status) {
            $sql .= " AND o.status = ?";
            $params[] = $status;
        }
        if ($search) {
            $sql .= " AND (o.queue_number LIKE ? OR o.customer_name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $sql .= " GROUP BY o.id ORDER BY o.created_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll();

        sendSuccess($orders);
    }

    private function getOrder(): void {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if (!$id) sendError('Order ID required', 422);

        $stmt = $this->db->prepare("SELECT * FROM orders WHERE id = ?");
        $stmt->execute([$id]);
        $order = $stmt->fetch();

        if (!$order) sendError('Order not found', 404);

        // Get order items
        $itemStmt = $this->db->prepare(
            "SELECT oi.*, m.image_path FROM order_items oi
             LEFT JOIN menu_items m ON m.id = oi.menu_item_id
             WHERE oi.order_id = ?"
        );
        $itemStmt->execute([$id]);
        $order['items'] = $itemStmt->fetchAll();

        sendSuccess($order);
    }

    private function updateStatus(): void {
        $body = getRequestBody();
        requireFields($body, ['id', 'status']);

        $id     = (int)$body['id'];
        $status = $body['status'];
        $allowed = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

        if (!in_array($status, $allowed)) {
            sendError('Invalid status value.', 422);
        }

        $stmt = $this->db->prepare("UPDATE orders SET status = ? WHERE id = ?");
        $stmt->execute([$status, $id]);

        if ($stmt->rowCount() === 0) sendError('Order not found', 404);

        // Get queue number for log
        $orderStmt = $this->db->prepare("SELECT queue_number, customer_name FROM orders WHERE id=?");
        $orderStmt->execute([$id]);
        $order = $orderStmt->fetch();

        $admin = requireAdminAuth();
        logActivity($this->db, $admin['id'], 'ORDER_STATUS',
            "Order #{$order['queue_number']} ({$order['customer_name']}) → {$status}");

        sendSuccess(['id' => $id, 'status' => $status], 'Order status updated');
    }

    private function getReadyOrders(): void {
        $stmt = $this->db->prepare(
            "SELECT id, queue_number, customer_name, status, updated_at
             FROM orders
             WHERE order_date = CURDATE() AND status IN ('ready','preparing')
             ORDER BY
               CASE status WHEN 'ready' THEN 0 ELSE 1 END,
               created_at ASC"
        );
        $stmt->execute();
        sendSuccess($stmt->fetchAll());
    }

    private function getPendingCount(): void {
        $stmt = $this->db->query(
            "SELECT status, COUNT(*) as count FROM orders
             WHERE order_date = CURDATE()
             GROUP BY status"
        );
        $rows = $stmt->fetchAll();
        $counts = [];
        foreach ($rows as $row) {
            $counts[$row['status']] = (int)$row['count'];
        }
        sendSuccess($counts);
    }

    private function cancelOrder(): void {
        $body = getRequestBody();
        requireFields($body, ['id']);

        $id = (int)$body['id'];
        $stmt = $this->db->prepare("UPDATE orders SET status='cancelled' WHERE id=?");
        $stmt->execute([$id]);

        sendSuccess(null, 'Order cancelled');
    }

    private function getHistory(): void {
        $month  = $_GET['month']  ?? date('Y-m');
        $search = $_GET['search'] ?? null;
        $status = $_GET['status'] ?? null;

        [$year, $mon] = explode('-', $month . '-01');

        $sql    = "SELECT o.*, COUNT(oi.id) as item_count
                   FROM orders o
                   LEFT JOIN order_items oi ON oi.order_id = o.id
                   WHERE YEAR(o.order_date)=? AND MONTH(o.order_date)=?";
        $params = [(int)$year, (int)$mon];

        if ($status) {
            $sql .= " AND o.status=?";
            $params[] = $status;
        }
        if ($search) {
            $sql .= " AND (o.queue_number LIKE ? OR o.customer_name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $sql .= " GROUP BY o.id ORDER BY o.created_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        sendSuccess($stmt->fetchAll());
    }

    private function exportCSV(): void {
        $month = $_GET['month'] ?? date('Y-m');
        [$year, $mon] = explode('-', $month . '-01');

        $stmt = $this->db->prepare(
            "SELECT o.queue_number, o.customer_name, o.total_amount, o.payment_amount,
                    o.change_amount, o.status, o.created_at,
                    GROUP_CONCAT(CONCAT(oi.item_name,'x',oi.quantity) SEPARATOR '; ') as items
             FROM orders o
             LEFT JOIN order_items oi ON oi.order_id = o.id
             WHERE YEAR(o.order_date)=? AND MONTH(o.order_date)=?
             GROUP BY o.id ORDER BY o.created_at"
        );
        $stmt->execute([(int)$year, (int)$mon]);
        $orders = $stmt->fetchAll();

        // Output CSV
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="orders-' . $month . '.csv"');

        $out = fopen('php://output', 'w');
        fputcsv($out, ['Queue#', 'Customer', 'Total', 'Payment', 'Change', 'Status', 'Date', 'Items']);
        foreach ($orders as $row) {
            fputcsv($out, [
                $row['queue_number'], $row['customer_name'], $row['total_amount'],
                $row['payment_amount'], $row['change_amount'], $row['status'],
                $row['created_at'], $row['items']
            ]);
        }
        fclose($out);
        exit;
    }
}
