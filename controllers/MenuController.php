<?php
/**
 * Loren Eatery POS - Menu Controller
 * Full CRUD for menu items with image upload support
 */

class MenuController {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function handle(string $action, string $method): void {
        switch ($action) {
            case 'list':
                $this->listItems();
                break;
            case 'get':
                $this->getItem();
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
            case 'toggle':
                if ($method === 'POST') { requireAdminAuth(); $this->toggleAvailability(); }
                else sendError('Method not allowed', 405);
                break;
            default:
                sendError('Unknown menu action', 404);
        }
    }

    private function listItems(): void {
        $categoryId = isset($_GET['category_id']) ? (int)$_GET['category_id'] : null;
        $available  = isset($_GET['available']) ? (int)$_GET['available'] : null;

        $sql    = "SELECT m.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon
                   FROM menu_items m
                   JOIN categories c ON c.id = m.category_id
                   WHERE 1=1";
        $params = [];

        if ($categoryId !== null) {
            $sql .= " AND m.category_id = ?";
            $params[] = $categoryId;
        }
        if ($available !== null) {
            $sql .= " AND m.is_available = ?";
            $params[] = $available;
        }

        $sql .= " ORDER BY c.sort_order ASC, m.sort_order ASC, m.name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        // Resolve image URLs
        foreach ($items as &$item) {
            if (!$item['image_path']) {
                $item['image_url'] = null;
            } elseif (str_starts_with($item['image_path'], 'http')) {
                $item['image_url'] = $item['image_path'];
            } elseif (str_starts_with($item['image_path'], 'assets/')) {
                $item['image_url'] = APP_BASE_PATH . $item['image_path'];
            } else {
                $item['image_url'] = UPLOAD_URL . $item['image_path'];
            }
        }

        sendSuccess($items);
    }

    private function getItem(): void {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if (!$id) sendError('ID is required', 422);

        $stmt = $this->db->prepare(
            "SELECT m.*, c.name as category_name FROM menu_items m
             JOIN categories c ON c.id = m.category_id WHERE m.id = ?"
        );
        $stmt->execute([$id]);
        $item = $stmt->fetch();

        if (!$item) sendError('Menu item not found', 404);

        if (!$item['image_path']) {
            $item['image_url'] = null;
        } elseif (str_starts_with($item['image_path'], 'http')) {
            $item['image_url'] = $item['image_path'];
        } elseif (str_starts_with($item['image_path'], 'assets/')) {
            $item['image_url'] = APP_BASE_PATH . $item['image_path'];
        } else {
            $item['image_url'] = UPLOAD_URL . $item['image_path'];
        }
        sendSuccess($item);
    }

    private function create(): void {
        $body = getRequestBody();
        requireFields($body, ['category_id', 'name', 'price']);

        $categoryId  = (int)$body['category_id'];
        $name        = sanitize($body['name']);
        $description = sanitize($body['description'] ?? '');
        $price       = (float)$body['price'];
        $available   = isset($body['is_available']) ? (int)$body['is_available'] : 1;
        $bestseller  = isset($body['is_bestseller']) ? (int)$body['is_bestseller'] : 0;
        $sortOrder   = (int)($body['sort_order'] ?? 0);
        $imagePath   = sanitize($body['image_path'] ?? '');

        $stmt = $this->db->prepare(
            "INSERT INTO menu_items (category_id, name, description, price, image_path, is_available, is_bestseller, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([$categoryId, $name, $description, $price, $imagePath ?: null, $available, $bestseller, $sortOrder]);
        $id = $this->db->lastInsertId();

        $admin = requireAdminAuth();
        logActivity($this->db, $admin['id'], 'MENU_CREATE', "Created menu item: $name (₱$price)");

        sendSuccess(['id' => $id, 'name' => $name], 'Menu item created', 201);
    }

    private function update(): void {
        $body = getRequestBody();
        requireFields($body, ['id', 'category_id', 'name', 'price']);

        $id          = (int)$body['id'];
        $categoryId  = (int)$body['category_id'];
        $name        = sanitize($body['name']);
        $description = sanitize($body['description'] ?? '');
        $price       = (float)$body['price'];
        $available   = isset($body['is_available']) ? (int)$body['is_available'] : 1;
        $bestseller  = isset($body['is_bestseller']) ? (int)$body['is_bestseller'] : 0;
        $sortOrder   = (int)($body['sort_order'] ?? 0);

        // Preserve existing image if not provided
        $imagePath = null;
        if (isset($body['image_path'])) {
            $imagePath = sanitize($body['image_path']) ?: null;
        } else {
            $existing = $this->db->prepare("SELECT image_path FROM menu_items WHERE id=?");
            $existing->execute([$id]);
            $imagePath = $existing->fetchColumn();
        }

        $stmt = $this->db->prepare(
            "UPDATE menu_items SET category_id=?, name=?, description=?, price=?,
             image_path=?, is_available=?, is_bestseller=?, sort_order=? WHERE id=?"
        );
        $stmt->execute([$categoryId, $name, $description, $price, $imagePath, $available, $bestseller, $sortOrder, $id]);

        $admin = requireAdminAuth();
        logActivity($this->db, $admin['id'], 'MENU_UPDATE', "Updated menu item: $name");

        sendSuccess(null, 'Menu item updated');
    }

    private function delete(): void {
        $body = getRequestBody();
        requireFields($body, ['id']);

        $id = (int)$body['id'];

        // Get item name for log
        $stmt = $this->db->prepare("SELECT name, image_path FROM menu_items WHERE id=?");
        $stmt->execute([$id]);
        $item = $stmt->fetch();

        if (!$item) sendError('Menu item not found', 404);

        // Delete image file if exists
        if ($item['image_path'] && file_exists(UPLOAD_DIR . $item['image_path'])) {
            unlink(UPLOAD_DIR . $item['image_path']);
        }

        $this->db->prepare("DELETE FROM menu_items WHERE id=?")->execute([$id]);

        $admin = requireAdminAuth();
        logActivity($this->db, $admin['id'], 'MENU_DELETE', "Deleted menu item: {$item['name']}");

        sendSuccess(null, 'Menu item deleted');
    }

    private function toggleAvailability(): void {
        $body = getRequestBody();
        requireFields($body, ['id']);

        $id = (int)$body['id'];
        $this->db->prepare(
            "UPDATE menu_items SET is_available = NOT is_available WHERE id=?"
        )->execute([$id]);

        $stmt = $this->db->prepare("SELECT id, name, is_available FROM menu_items WHERE id=?");
        $stmt->execute([$id]);
        $item = $stmt->fetch();

        sendSuccess($item, 'Availability toggled');
    }
}
