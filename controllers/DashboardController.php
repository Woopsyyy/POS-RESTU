<?php
/**
 * Loren Eatery POS - Dashboard Controller
 * Stats and activity logs for admin panel
 */

class DashboardController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function handle(string $action, string $method): void {
        requireAdminAuth();
        switch ($action) {
            case 'stats':
                $this->getStats();
                break;
            case 'activity':
                $this->getActivity();
                break;
            case 'revenue':
                $this->getRevenue();
                break;
            default:
                sendError('Unknown dashboard action', 404);
        }
    }

    private function getStats(): void {
        $today = date('Y-m-d');

        // Today's status counts
        $stmt = $this->db->prepare(
            "SELECT status, COUNT(*) as count FROM orders WHERE order_date=? GROUP BY status"
        );
        $stmt->execute([$today]);
        $rows = $stmt->fetchAll();
        $statusCounts = ['pending' => 0, 'preparing' => 0, 'ready' => 0, 'completed' => 0, 'cancelled' => 0];
        foreach ($rows as $r) {
            $statusCounts[$r['status']] = (int)$r['count'];
        }

        // Today's revenue
        $stmt = $this->db->prepare(
            "SELECT COALESCE(SUM(total_amount), 0) as revenue FROM orders
             WHERE order_date=? AND status != 'cancelled'"
        );
        $stmt->execute([$today]);
        $revenue = (float)$stmt->fetchColumn();

        // Total menu items
        $menuCount = (int)$this->db->query("SELECT COUNT(*) FROM menu_items WHERE is_available=1")->fetchColumn();

        // Last queue number today
        $stmt = $this->db->prepare("SELECT last_number FROM queue_tracker WHERE date=?");
        $stmt->execute([$today]);
        $lastQueue = $stmt->fetchColumn() ?: 0;

        sendSuccess([
            'today'          => $today,
            'status_counts'  => $statusCounts,
            'today_revenue'  => $revenue,
            'menu_items'     => $menuCount,
            'orders_today'   => array_sum($statusCounts),
            'last_queue'     => $lastQueue,
        ]);
    }

    private function getActivity(): void {
        $limit = min((int)($_GET['limit'] ?? 20), 50);

        $stmt = $this->db->prepare(
            "SELECT al.*, a.username FROM activity_logs al
             LEFT JOIN admins a ON a.id = al.admin_id
             ORDER BY al.created_at DESC LIMIT ?"
        );
        $stmt->execute([$limit]);
        sendSuccess($stmt->fetchAll());
    }

    private function getRevenue(): void {
        // Last 7 days revenue chart
        $stmt = $this->db->query(
            "SELECT DATE(order_date) as date,
                    COALESCE(SUM(total_amount),0) as revenue,
                    COUNT(*) as orders
             FROM orders
             WHERE order_date >= CURDATE() - INTERVAL 7 DAY
               AND status != 'cancelled'
             GROUP BY DATE(order_date)
             ORDER BY date ASC"
        );
        sendSuccess($stmt->fetchAll());
    }
}
