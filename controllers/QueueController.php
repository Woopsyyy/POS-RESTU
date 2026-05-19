<?php
/**
 * Loren Eatery POS - Queue Controller
 */

class QueueController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function handle(string $action, string $method): void {
        switch ($action) {
            case 'today':
                $this->getTodayQueue();
                break;
            case 'display':
                $this->getDisplayQueue();
                break;
            default:
                sendError('Unknown queue action', 404);
        }
    }

    private function getTodayQueue(): void {
        $stmt = $this->db->prepare(
            "SELECT last_number, prefix FROM queue_tracker WHERE date = CURDATE()"
        );
        $stmt->execute();
        $row = $stmt->fetch();
        sendSuccess([
            'last_number' => $row['last_number'] ?? 0,
            'prefix'      => $row['prefix'] ?? 'A',
            'date'        => date('Y-m-d'),
        ]);
    }

    private function getDisplayQueue(): void {
        $stmt = $this->db->prepare(
            "SELECT id, queue_number, customer_name, status, updated_at
             FROM orders
             WHERE order_date = CURDATE() AND status IN ('preparing','ready','pending')
             ORDER BY
               CASE status WHEN 'ready' THEN 0 WHEN 'preparing' THEN 1 ELSE 2 END,
               created_at ASC
             LIMIT 20"
        );
        $stmt->execute();
        sendSuccess($stmt->fetchAll());
    }
}
