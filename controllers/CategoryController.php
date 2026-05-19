<?php
/**
 * Loren Eatery POS - Category Controller
 */

class CategoryController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function handle(string $action, string $method): void {
        switch ($action) {
            case 'list':
                $this->listCategories();
                break;
            case 'create':
                if ($method === 'POST') { requireAdminAuth(); $this->create(); }
                else sendError('Method not allowed', 405);
                break;
            case 'update':
                if ($method === 'POST' || $method === 'PUT') { requireAdminAuth(); $this->update(); }
                else sendError('Method not allowed', 405);
                break;
            case 'delete':
                if ($method === 'POST' || $method === 'DELETE') { requireAdminAuth(); $this->delete(); }
                else sendError('Method not allowed', 405);
                break;
            default:
                sendError('Unknown category action', 404);
        }
    }

    private function listCategories(): void {
        $stmt = $this->db->query(
            "SELECT c.*, COUNT(m.id) as item_count
             FROM categories c
             LEFT JOIN menu_items m ON m.category_id = c.id AND m.is_available = 1
             WHERE c.is_active = 1
             GROUP BY c.id
             ORDER BY c.sort_order ASC"
        );
        sendSuccess($stmt->fetchAll());
    }

    private function create(): void {
        $body = getRequestBody();
        requireFields($body, ['name']);

        $name  = sanitize($body['name']);
        $icon  = sanitize($body['icon'] ?? '🍽️');
        $slug  = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
        $order = (int)($body['sort_order'] ?? 0);

        $stmt = $this->db->prepare(
            "INSERT INTO categories (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([$name, $slug, $icon, $order]);
        $id = $this->db->lastInsertId();

        $admin = requireAdminAuth();
        logActivity($this->db, $admin['id'], 'CATEGORY_CREATE', "Created category: $name");

        sendSuccess(['id' => $id, 'name' => $name, 'slug' => $slug], 'Category created', 201);
    }

    private function update(): void {
        $body = getRequestBody();
        requireFields($body, ['id', 'name']);

        $id    = (int)$body['id'];
        $name  = sanitize($body['name']);
        $icon  = sanitize($body['icon'] ?? '🍽️');
        $order = (int)($body['sort_order'] ?? 0);
        $active = isset($body['is_active']) ? (int)$body['is_active'] : 1;

        $stmt = $this->db->prepare(
            "UPDATE categories SET name=?, icon=?, sort_order=?, is_active=? WHERE id=?"
        );
        $stmt->execute([$name, $icon, $order, $active, $id]);

        sendSuccess(null, 'Category updated');
    }

    private function delete(): void {
        $body = getRequestBody();
        requireFields($body, ['id']);

        $id = (int)$body['id'];
        $this->db->prepare("DELETE FROM categories WHERE id=?")->execute([$id]);

        sendSuccess(null, 'Category deleted');
    }
}
